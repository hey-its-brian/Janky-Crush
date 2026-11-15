// Level setup and goal tracking. Pure logic, shared by the game and the
// level-tuning simulator.

import { Board, GUMMY } from './board.js';

// Layout characters, one per cell (9 strings of 9):
//   ' '  not part of the board
//   '.'  plain cell
//   '1'  one layer of jelly
//   '2'  two layers of jelly
//   'k'  a coconut (one layer)
//   'K'  a big coconut (two layers)
//   'm'  a mochi (one layer)
//   'M'  a double mochi (two layers)
//   'u'  a gummy cube (falls like a piece)
//   'j'  jam (one layer; it spreads)
//   'J'  jam on one layer of jelly
//   'L'  a locked fruit
//   'l'  a locked fruit on one layer of jelly
export function parseLayout(layout) {
  const grid = (f) => layout.map((row) => [...row].map(f));
  const mask = grid((ch) => ch !== ' ');
  const jelly = grid((ch) => (ch === '1' || ch === 'l' || ch === 'J' ? 1 : ch === '2' ? 2 : 0));
  const lock = grid((ch) => ch === 'L' || ch === 'l');
  const block = grid((ch) => ({ k: 1, K: 2, m: 1, M: 2, j: 1, J: 1 })[ch] ?? 0);
  const blockType = grid((ch) => ('kK'.includes(ch) ? 'coconut' : 'mM'.includes(ch) ? 'mochi' : 'jJ'.includes(ch) ? 'jam' : null));
  const gummy = grid((ch) => ch === 'u');
  return { rows: layout.length, cols: layout[0].length, mask, jelly, block, blockType, gummy, lock };
}

export function setupBoard(level, rng) {
  const { rows, cols, mask, jelly, block, blockType, gummy, lock } = parseLayout(level.layout);
  const board = new Board({ rows, cols, mask, colors: level.colors, rng });
  board.jelly = jelly;
  board.block = block;
  board.blockType = blockType;
  board.lock = lock;
  // `portals` in a level: [[fromRow, fromCol, toRow, toCol, color], ...].
  board.portals = (level.portals ?? []).map(([fr, fc, tr, tc, color], i) => ({ from: [fr, fc], to: [tr, tc], color: color ?? i }));
  board.dispensers = (level.dispensers ?? []).map((d) => ({ ...d, n: 0 }));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (gummy[r][c]) board.grid[r][c] = board.newCandy(null, GUMMY);
  board.fillInitial();
  if (level.goal.type === 'ingredients') {
    const { count } = level.goal;
    const maxOnBoard = level.goal.maxOnBoard ?? Math.min(3, count);
    board.setExits();
    const first = Math.min(count, maxOnBoard);
    board.placeIngredients(first);
    board.spawner = { remaining: count - first, maxOnBoard, chance: 0.5 };
    // Ingredients replace candies, which can use up the only legal move.
    if (!board.findPossibleMove()) board.shuffle();
  }
  // `belts` in a level: [[[r, c], [r, c], ...], ...], each belt a list of
  // cells in the order that it moves.
  board.belts = level.belts ?? [];
  // `timers` in a level: { start, fuse, every, max }. `start` timer fruit
  // are on the board at the beginning, each with `fuse` on its count. A
  // new one drops in every `every` moves while fewer than `max` are there.
  if (level.timers) {
    const { start = 1, fuse, every = 0, max = start } = level.timers;
    board.timerRule = { fuse, every, max };
    board.placeTimers(start, fuse);
  }
  return board;
}

export class LevelState {
  constructor(level, board) {
    this.level = level;
    this.board = board;
    this.moves = level.moves;
    this.score = 0;
    this.collected = 0;
    // For the end-of-level review.
    this.stats = { striped: 0, wrapped: 0, bomb: 0, bestCascade: 0, foamCleared: 0, blockers: 0, bonus: 0, defused: 0 };
    this.turns = 0; // moves made
    // Where a timer fruit went off ([r, c]). The level is then lost.
    this.exploded = null;
    this.inBonus = false;
    // Fruit gathered toward a 'collect' goal, by color.
    this.gathered = {};
  }

  // Tally what a step did: specials made, the longest chain, jelly
  // cleared, and points earned in the end-of-level bonus.
  noteStep(step, cascade, points) {
    const st = this.stats;
    st.foamCleared += step.jellyHit.length;
    st.blockers += (step.blocksHit ?? []).filter((h) => h.left === 0).length +
      step.cleared.filter((x) => x.special === GUMMY).length;
    st.defused += step.cleared.filter((x) => x.timer != null).length;
    if (this.inBonus) {
      st.bonus += points;
      return;
    }
    st.bestCascade = Math.max(st.bestCascade, cascade);
    for (const x of step.cleared) if (x.color) this.gathered[x.color] = (this.gathered[x.color] ?? 0) + 1;
    for (const m of step.created) {
      if (m.special === 'bomb') st.bomb++;
      else if (m.special === 'wrapped') st.wrapped++;
      else st.striped++;
    }
  }

  get goal() {
    return this.level.goal;
  }

  jellyLeft() {
    return this.board.jellyCount();
  }

  // Blockers still on the board: coconuts and mochi (a two-layer one
  // counts once, however many hits it still needs) and gummy cubes.
  blockersLeft() {
    const b = this.board;
    let n = 0;
    for (let r = 0; r < b.rows; r++)
      for (let c = 0; c < b.cols; c++)
        if (b.mask[r][c] && (b.block[r][c] > 0 || b.grid[r][c]?.special === GUMMY)) n++;
    return n;
  }

  // Each color still to collect: { r: 12, p: 0 }.
  collectLeft() {
    if (this.goal.type !== 'collect') return {};
    const out = {};
    for (const [color, n] of Object.entries(this.goal.targets)) out[color] = Math.max(0, n - (this.gathered[color] ?? 0));
    return out;
  }

  ingredientsLeft() {
    return this.goal.type === 'ingredients' ? this.goal.count - this.collected : 0;
  }

  // Jelly and ingredient levels end the moment the goal is met. Score
  // levels always play out every move.
  isComplete() {
    switch (this.goal.type) {
      case 'jelly':
        return this.jellyLeft() === 0;
      case 'ingredients':
        return this.ingredientsLeft() <= 0;
      case 'blockers':
        return this.blockersLeft() === 0;
      case 'collect':
        return Object.values(this.collectLeft()).every((n) => n === 0);
      default:
        return false;
    }
  }

  isOver() {
    return Boolean(this.exploded) || this.isComplete() || this.moves <= 0;
  }

  // A score level with its moves spent and the score reached is safe:
  // the timers stop there.
  scoreReached() {
    return this.goal.type === 'score' && this.moves <= 0 && this.score >= (this.level.stars?.[0] ?? Infinity);
  }

  won() {
    if (this.exploded) return false;
    return this.goal.type === 'score' ? this.score >= this.level.stars[0] : this.isComplete();
  }

  stars() {
    if (!this.won()) return 0;
    return Math.max(1, this.level.stars.filter((s) => this.score >= s).length);
  }
}
