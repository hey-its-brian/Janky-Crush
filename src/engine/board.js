// Pure board logic: no DOM, no timing. The game loop calls these steps in
// order and hands the returned descriptions to the renderer to animate.

import { makeRng, randInt } from '../rng.js';

export const COLORS = ['r', 'o', 'y', 'g', 'b', 'p'];

let nextId = 1;

export class Board {
  constructor({ rows = 9, cols = 9, mask = null, colors = COLORS.length, rng = makeRng() } = {}) {
    this.rows = rows;
    this.cols = cols;
    this.colors = COLORS.slice(0, colors);
    this.rng = rng;
    // mask[r][c] === false means the cell is not part of the board.
    this.mask = mask ?? Array.from({ length: rows }, () => Array(cols).fill(true));
    this.grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  }

  playable(r, c) {
    return r >= 0 && r < this.rows && c >= 0 && c < this.cols && this.mask[r][c];
  }

  get(r, c) {
    return this.playable(r, c) ? this.grid[r][c] : null;
  }

  newCandy(color) {
    return { id: nextId++, color };
  }

  randomColor() {
    return this.colors[randInt(this.rng, this.colors.length)];
  }

  // Fill every playable cell so the board starts with no matches and at
  // least one legal move.
  fillInitial() {
    for (let attempt = 0; attempt < 100; attempt++) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (!this.mask[r][c]) continue;
          const banned = new Set();
          const l1 = this.get(r, c - 1), l2 = this.get(r, c - 2);
          if (l1 && l2 && l1.color === l2.color) banned.add(l1.color);
          const u1 = this.get(r - 1, c), u2 = this.get(r - 2, c);
          if (u1 && u2 && u1.color === u2.color) banned.add(u1.color);
          const options = this.colors.filter((k) => !banned.has(k));
          this.grid[r][c] = this.newCandy(options[randInt(this.rng, options.length)]);
        }
      }
      if (this.findPossibleMove()) return;
    }
    throw new Error('Could not build a starting board with a legal move');
  }

  // Load a fixed layout (array of strings, '.' for an empty playable cell,
  // ' ' for a cell outside the board). Used by tests.
  load(rowsOfChars) {
    this.rows = rowsOfChars.length;
    this.cols = rowsOfChars[0].length;
    this.mask = rowsOfChars.map((row) => [...row].map((ch) => ch !== ' '));
    this.grid = rowsOfChars.map((row) =>
      [...row].map((ch) => (ch === ' ' || ch === '.' ? null : this.newCandy(ch)))
    );
    return this;
  }

  toStrings() {
    return this.grid.map((row, r) =>
      row.map((cell, c) => (!this.mask[r][c] ? ' ' : cell ? cell.color : '.')).join('')
    );
  }

  static adjacent(a, b) {
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
  }

  swap(a, b) {
    const t = this.grid[a[0]][a[1]];
    this.grid[a[0]][a[1]] = this.grid[b[0]][b[1]];
    this.grid[b[0]][b[1]] = t;
  }

  // Length of the same-color run through (r, c) along one axis.
  runLength(r, c, dr, dc) {
    const cell = this.get(r, c);
    if (!cell) return 0;
    let n = 1;
    for (let i = 1; this.get(r + dr * i, c + dc * i)?.color === cell.color; i++) n++;
    for (let i = 1; this.get(r - dr * i, c - dc * i)?.color === cell.color; i++) n++;
    return n;
  }

  matchesAt(r, c) {
    return this.runLength(r, c, 0, 1) >= 3 || this.runLength(r, c, 1, 0) >= 3;
  }

  // Every straight run of 3+ on the board, as { dir, cells }.
  findMatches() {
    const groups = [];
    const scan = (outer, inner, at, dir) => {
      for (let i = 0; i < outer; i++) {
        let run = [];
        for (let j = 0; j <= inner; j++) {
          const [r, c] = at(i, j);
          const cell = j < inner ? this.get(r, c) : null;
          if (cell && run.length && this.get(...run[0]).color === cell.color) {
            run.push([r, c]);
            continue;
          }
          if (run.length >= 3) groups.push({ dir, cells: run });
          run = cell ? [[r, c]] : [];
        }
      }
    };
    scan(this.rows, this.cols, (i, j) => [i, j], 'h');
    scan(this.cols, this.rows, (i, j) => [j, i], 'v');
    return groups;
  }

  // Swap and keep it only if it makes a match.
  trySwap(a, b) {
    if (!Board.adjacent(a, b) || !this.get(...a) || !this.get(...b)) return false;
    this.swap(a, b);
    if (this.matchesAt(...a) || this.matchesAt(...b)) return true;
    this.swap(a, b);
    return false;
  }

  clear(cells) {
    const removed = [];
    for (const [r, c] of cells) {
      const cell = this.grid[r][c];
      if (cell) removed.push({ ...cell, at: [r, c] });
      this.grid[r][c] = null;
    }
    return removed;
  }

  // Drop candies straight down into empty cells, skipping cells outside the
  // board. Returns [{ id, from, to }] for the renderer.
  applyGravity() {
    const moves = [];
    for (let c = 0; c < this.cols; c++) {
      const slots = [];
      for (let r = this.rows - 1; r >= 0; r--) if (this.mask[r][c]) slots.push(r);
      let write = 0;
      for (let read = 0; read < slots.length; read++) {
        const r = slots[read];
        const cell = this.grid[r][c];
        if (!cell) continue;
        const target = slots[write++];
        if (target !== r) {
          this.grid[target][c] = cell;
          this.grid[r][c] = null;
          moves.push({ id: cell.id, from: [r, c], to: [target, c] });
        }
      }
    }
    return moves;
  }

  // Fill empty cells from the top. Each spawn says how many rows above the
  // board it starts, so a column's new candies stack up and fall in together.
  refill() {
    const spawns = [];
    for (let c = 0; c < this.cols; c++) {
      const empty = [];
      for (let r = 0; r < this.rows; r++) if (this.mask[r][c] && !this.grid[r][c]) empty.push(r);
      empty.forEach((r, i) => {
        const cell = this.newCandy(this.randomColor());
        this.grid[r][c] = cell;
        spawns.push({ id: cell.id, color: cell.color, to: [r, c], fromRow: i - empty.length });
      });
    }
    return spawns;
  }

  findPossibleMove() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.get(r, c)) continue;
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const a = [r, c], b = [r + dr, c + dc];
          if (!this.get(...b)) continue;
          this.swap(a, b);
          const ok = this.matchesAt(...a) || this.matchesAt(...b);
          this.swap(a, b);
          if (ok) return [a, b];
        }
      }
    }
    return null;
  }

  // Rearrange the existing candies until there are no matches and at least
  // one move. Returns [{ id, from, to }].
  shuffle() {
    const cells = [];
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) if (this.grid[r][c]) cells.push([r, c]);
    const candies = cells.map(([r, c]) => ({ cell: this.grid[r][c], from: [r, c] }));
    for (let attempt = 0; attempt < 200; attempt++) {
      for (let i = candies.length - 1; i > 0; i--) {
        const j = randInt(this.rng, i + 1);
        [candies[i], candies[j]] = [candies[j], candies[i]];
      }
      cells.forEach(([r, c], i) => (this.grid[r][c] = candies[i].cell));
      if (!this.findMatches().length && this.findPossibleMove()) {
        return cells.map((to, i) => ({ id: candies[i].cell.id, from: candies[i].from, to }));
      }
    }
    // Colors alone can't make a playable board; recolor from scratch.
    for (const [r, c] of cells) this.grid[r][c] = null;
    this.fillInitial();
    return null;
  }
}

// Points for one cascade step. Bigger runs are worth more, and each cascade
// after the first multiplies the step.
export function scoreFor(groups, cascade) {
  let pts = 0;
  for (const g of groups) pts += g.cells.length >= 5 ? 200 : g.cells.length === 4 ? 120 : 60;
  return pts * cascade;
}

export function uniqueCells(groups) {
  const seen = new Map();
  for (const g of groups) for (const [r, c] of g.cells) seen.set(r * 100 + c, [r, c]);
  return [...seen.values()];
}
