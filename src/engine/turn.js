// A turn as a sequence of events. The board and level state change as the
// generator runs, one event at a time, so the game can animate each event
// before asking for the next, and the simulator can just run it through.
//
// Events:
//   { type: 'step', step, points }     matches, blasts, new specials
//   { type: 'fall', falls, spawns }    gravity and refill
//   { type: 'collect', items, points } ingredients reaching an exit
//   { type: 'shuffle', moves }         no moves left, board rearranged

export const POINTS_PER_INGREDIENT = 1000;

// The player swapped a and b (already checked with isValidSwap).
export function* playTurn(board, state, a, b) {
  const combo = board.isComboSwap(a, b);
  board.swap(a, b);
  state.moves--;
  const step = combo ? board.comboStep(a, b) : board.resolveStep({ from: a, to: b });
  yield* settle(board, state, step);
}

// The end-of-level bonus: every leftover move becomes a striped candy, and
// every special on the board fires, until nothing special is left.
export function* bonusRound(board, state) {
  let n = state.moves;
  state.moves = 0;
  for (let round = 0; round < 12; round++) {
    const step = board.primeBonus(n);
    n = 0;
    if (!step) return;
    yield* settle(board, state, step);
  }
}

function* settle(board, state, first) {
  let step = first;
  for (let cascade = 1; step; cascade++) {
    const points = step.points * cascade;
    state.score += points;
    yield { type: 'step', step, points };
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
    yield { type: 'fall', falls, spawns };
    const items = board.collectIngredients();
    if (!items.length) return;
    const points = items.length * POINTS_PER_INGREDIENT;
    state.collected += items.length;
    state.score += points;
    yield { type: 'collect', items, points };
  }
}

// Run a whole turn without animating it.
export function runTurn(board, state, a, b) {
  for (const _ of playTurn(board, state, a, b));
}

export function runBonus(board, state) {
  for (const _ of bonusRound(board, state));
}
