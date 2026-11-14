// A turn as a sequence of events. The board and level state change as the
// generator runs, one event at a time, so the game can animate each event
// before asking for the next, and the simulator can just run it through.
//
// Events:
//   { type: 'step', step, points, cascade }  matches, blasts, new specials
//   { type: 'fall', falls, spawns }    gravity and refill
//   { type: 'collect', items, points } ingredients reaching an exit
//   { type: 'shuffle', moves }         no moves left, board rearranged
//   { type: 'tick', timers }           timer fruit counted down: [{ id, at, left }]
//   { type: 'explode', timers }        a timer got to zero: the level is lost
//   { type: 'spread', from, to, eaten } jam grew over a fruit
//   { type: 'defuse', ids }            the level is won: timers stop

export const POINTS_PER_INGREDIENT = 1000;

// The player swapped a and b (already checked with isValidSwap).
export function* playTurn(board, state, a, b) {
  const combo = board.isComboSwap(a, b);
  board.swap(a, b);
  state.moves--;
  state.turns++;
  const rule = board.timerRule;
  if (rule?.every && state.turns % rule.every === 0) board.timerDue = true;
  const step = combo ? board.comboStep(a, b) : board.resolveStep({ from: a, to: b });
  const seen = { jamHit: false };
  yield* settle(board, state, step, seen);
  yield* afterMove(board, state, seen);
}

// What the board does after each move of the player (not after a
// booster): timer fruit count down, and jam grows if none of it was
// cleared in the move.
function* afterMove(board, state, seen) {
  if (state.isComplete() || state.scoreReached()) return;
  const { ticked, exploded } = board.tickTimers();
  if (ticked.length) yield { type: 'tick', timers: ticked };
  if (exploded.length) {
    state.exploded = exploded[0].at;
    yield { type: 'explode', timers: exploded };
    return;
  }
  if (seen.jamHit) return;
  const grown = board.spreadJam();
  if (!grown) return;
  yield { type: 'spread', ...grown };
  if (!board.findPossibleMove()) yield { type: 'shuffle', moves: board.shuffle() };
}

// Boosters. None of them uses up a move.

// Smash one piece (checked with board.smashStep returning a step).
export function* playSmash(board, state, at) {
  const step = board.smashStep(at);
  if (!step) return;
  yield* settle(board, state, step);
}

// Swap any two neighbors. If they make a match or a combo it resolves as
// usual; if not, they just trade places.
export function* playSwitch(board, state, a, b) {
  const combo = board.isComboSwap(a, b);
  board.swap(a, b);
  const step = combo ? board.comboStep(a, b) : board.resolveStep({ from: a, to: b });
  if (step) yield* settle(board, state, step);
  else if (!board.findPossibleMove()) yield { type: 'shuffle', moves: board.shuffle() };
}

// The end-of-level bonus: every leftover move becomes a striped candy, and
// every special on the board fires, until nothing special is left.
export function* bonusRound(board, state) {
  let n = state.moves;
  state.moves = 0;
  state.inBonus = true;
  const ids = board.defuseAll();
  if (ids.length) yield { type: 'defuse', ids };
  for (let round = 0; round < 12; round++) {
    const step = board.primeBonus(n);
    n = 0;
    if (!step) return;
    yield* settle(board, state, step);
  }
}

function* settle(board, state, first, seen = null) {
  let step = first;
  for (let cascade = 1; step; cascade++) {
    const points = step.points * cascade;
    state.score += points;
    state.noteStep(step, cascade, points);
    if (seen && step.blocksHit?.some((h) => h.type === 'jam')) seen.jamHit = true;
    yield { type: 'step', step, points, cascade };
    if (step.primed) {
      // Converted candies fire in place before anything falls.
      step = board.firePrimed();
      continue;
    }
    yield* fall(board, state);
    step = board.resolveStep(null);
  }
  if (!board.findPossibleMove()) yield { type: 'shuffle', moves: board.shuffle() };
}

function* fall(board, state) {
  for (;;) {
    const falls = board.applyGravity();
    const spawns = board.refill();
    const moved = falls.length || spawns.length;
    if (moved) yield { type: 'fall', falls, spawns };
    const items = board.collectIngredients();
    if (items.length) {
      const points = items.length * POINTS_PER_INGREDIENT;
      state.collected += items.length;
      state.score += points;
      yield { type: 'collect', items, points };
      continue;
    }
    // New pieces may now be able to slide around coconuts into gaps.
    if (moved && board.hasGaps()) continue;
    return;
  }
}

// Run a whole turn without animating it.
export function runTurn(board, state, a, b) {
  for (const _ of playTurn(board, state, a, b));
}

export function runBonus(board, state) {
  for (const _ of bonusRound(board, state));
}
