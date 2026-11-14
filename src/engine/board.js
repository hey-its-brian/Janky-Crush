// Pure board logic: no DOM, no timing. The game loop calls these steps in
// order and hands the returned descriptions to the renderer to animate.

import { makeRng, randInt } from '../rng.js';

export const COLORS = ['r', 'o', 'y', 'g', 'b', 'p'];

// Special candy kinds. A wrapped candy explodes once, stays on the board
// "lit", falls, then explodes a second time on the next step.
export const STRIPE_H = 'stripeH'; // clears its row
export const STRIPE_V = 'stripeV'; // clears its column
export const WRAPPED = 'wrapped';
export const WRAPPED_LIT = 'wrappedLit';
export const BOMB = 'bomb'; // color bomb: has no color of its own
// Ingredients can't be matched or blasted; they ride down to an exit.
export const INGREDIENT = 'ingredient';
export const INGREDIENT_KINDS = ['duck', 'pup'];
// A gummy cube: a blocker that falls like a piece but can't be swapped or
// matched. A match next to it or a blast pops it.
export const GUMMY = 'gummy';
// Pieces that stay put when the board is shuffled or primed.
const fixedPiece = (cell) => cell?.special === INGREDIENT || cell?.special === GUMMY;

const isStriped = (s) => s === STRIPE_H || s === STRIPE_V;

// Points on top of the match itself.
const POINTS_PER_SPECIAL_MADE = 60;
const POINTS_PER_BLASTED_CANDY = 30;
const POINTS_PER_JELLY = 100;
const POINTS_PER_COCONUT_HIT = 80;
const POINTS_PER_LOCK = 60;
const POINTS_PER_TIMER = 150; // a timer fruit cleared before it went off

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
    // Jelly layers under each cell (0, 1 or 2).
    this.jelly = Array.from({ length: rows }, () => Array(cols).fill(0));
    // Coconut blockers: layers left on each cell (0 = none). A coconut
    // takes up the cell (no piece there), doesn't fall, and cracks a layer
    // when a match lands next to it or a blast hits it.
    this.block = Array.from({ length: rows }, () => Array(cols).fill(0));
    // What each blocker is: 'coconut', 'mochi' or 'jam'. Coconut and mochi
    // have the same rules and their own look. Jam has one layer and
    // spreads: see spreadJam().
    this.blockType = Array.from({ length: rows }, () => Array(cols).fill(null));
    // Spouts above columns that drop in a special or a gummy every few
    // refills: [{ col, kind: 'bomb' | 'stripe' | 'wrapped' | 'gummy', every, n }].
    this.dispensers = [];
    // Cells where ingredients leave the board (keys from key()).
    this.exits = new Set();
    // { remaining, maxOnBoard, chance } on ingredient levels.
    this.spawner = null;
    // Locked cells: the piece there can't be swapped and doesn't fall. A
    // match that includes it, or a blast, opens the lock and leaves the
    // piece. Pieces above can't fall past it.
    this.lock = Array.from({ length: rows }, () => Array(cols).fill(false));
    // Portals: [{ from: [r, c], to: [r, c] }]. A piece that falls out of the
    // bottom of `from` comes in at the top of `to`.
    this.portals = [];
    this.paths = null; // falling paths, built when first needed
    // Timer fruit: a fruit with a count (`timer`) that goes down by one
    // each move. { fuse, every, max }: a new one, with `fuse` on its
    // count, drops in every `every` moves while fewer than `max` are on
    // the board. `timerDue` is set when the next refill must bring one.
    this.timerRule = null;
    this.timerDue = false;
  }

  // A copy to try moves on. Candy objects are copied so the original is
  // untouched; `rng` should differ so the copy can't see future refills.
  clone(rng) {
    const b = new Board({ rows: this.rows, cols: this.cols, mask: this.mask, rng });
    b.colors = [...this.colors];
    b.grid = this.grid.map((row) => row.map((c) => (c ? { ...c } : null)));
    b.jelly = this.jelly.map((row) => [...row]);
    b.block = this.block.map((row) => [...row]);
    b.blockType = this.blockType.map((row) => [...row]);
    b.dispensers = this.dispensers.map((d) => ({ ...d }));
    b.exits = new Set(this.exits);
    b.spawner = this.spawner ? { ...this.spawner } : null;
    b.lock = this.lock.map((row) => [...row]);
    b.portals = this.portals;
    b.paths = this.paths;
    b.timerRule = this.timerRule;
    b.timerDue = this.timerDue;
    return b;
  }

  playable(r, c) {
    return r >= 0 && r < this.rows && c >= 0 && c < this.cols && this.mask[r][c];
  }

  get(r, c) {
    return this.playable(r, c) ? this.grid[r][c] : null;
  }

  // The color a candy matches as, or null if it can't be part of a match.
  matchColor(r, c) {
    const cell = this.get(r, c);
    if (!cell || cell.special === BOMB || cell.special === WRAPPED_LIT || fixedPiece(cell)) return null;
    return cell.color;
  }

  newCandy(color, special = null) {
    return { id: nextId++, color: special === BOMB || special === INGREDIENT || special === GUMMY ? null : color, special };
  }

  newIngredient(kind) {
    return { ...this.newCandy(null, INGREDIENT), kind };
  }

  randomColor() {
    return this.colors[randInt(this.rng, this.colors.length)];
  }

  // Fill every playable cell so the board starts with no matches and at
  // least one legal move.
  // `keepLocked` leaves the pieces in locked cells as they are (a re-fill
  // in the middle of a level).
  fillInitial(keepLocked = false) {
    for (let attempt = 0; attempt < 100; attempt++) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (!this.mask[r][c] || this.block[r][c] || fixedPiece(this.grid[r][c])) continue;
          if (keepLocked && this.lock[r][c] && this.grid[r][c]) continue;
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

  // Load a fixed layout for tests. One character per cell:
  //   r o y g b p   plain candy
  //   R O Y G B P   horizontal striped      (vertical: set .special by hand)
  //   *             color bomb
  //   @             ingredient
  //   k K           coconut with one or two layers
  //   m M           mochi with one or two layers
  //   j             jam
  //   u             gummy cube
  //   .             empty playable cell
  //   (space)       outside the board
  load(rowsOfChars) {
    this.rows = rowsOfChars.length;
    this.cols = rowsOfChars[0].length;
    this.mask = rowsOfChars.map((row) => [...row].map((ch) => ch !== ' '));
    this.block = rowsOfChars.map((row) => [...row].map((ch) => ({ k: 1, K: 2, m: 1, M: 2, j: 1 })[ch] ?? 0));
    this.blockType = rowsOfChars.map((row) => [...row].map((ch) => ('kK'.includes(ch) ? 'coconut' : 'mM'.includes(ch) ? 'mochi' : ch === 'j' ? 'jam' : null)));
    this.grid = rowsOfChars.map((row) =>
      [...row].map((ch) => {
        if (' .kKmMj'.includes(ch)) return null;
        if (ch === 'u') return this.newCandy(null, GUMMY);
        if (ch === '*') return this.newCandy(null, BOMB);
        if (ch === '@') return this.newIngredient('duck');
        if (ch !== ch.toLowerCase()) return this.newCandy(ch.toLowerCase(), STRIPE_H);
        return this.newCandy(ch);
      })
    );
    this.jelly = this.grid.map((row) => row.map(() => 0));
    this.lock = this.grid.map((row) => row.map(() => false));
    this.paths = null;
    return this;
  }

  toStrings() {
    return this.grid.map((row, r) =>
      row
        .map((cell, c) => {
          if (!this.mask[r][c]) return ' ';
          if (this.block[r][c]) {
            if (this.blockType[r][c] === 'jam') return 'j';
            const ch = this.blockType[r][c] === 'mochi' ? 'm' : 'k';
            return this.block[r][c] > 1 ? ch.toUpperCase() : ch;
          }
          if (cell?.special === GUMMY) return 'u';
          if (!cell) return '.';
          if (cell.special === BOMB) return '*';
          if (cell.special === INGREDIENT) return '@';
          return cell.special ? cell.color.toUpperCase() : cell.color;
        })
        .join('')
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
    const color = this.matchColor(r, c);
    if (!color) return 0;
    let n = 1;
    for (let i = 1; this.matchColor(r + dr * i, c + dc * i) === color; i++) n++;
    for (let i = 1; this.matchColor(r - dr * i, c - dc * i) === color; i++) n++;
    return n;
  }

  matchesAt(r, c) {
    return this.runLength(r, c, 0, 1) >= 3 || this.runLength(r, c, 1, 0) >= 3;
  }

  // Every straight run of 3+ on the board, as { dir, color, cells }.
  findMatches() {
    const groups = [];
    const scan = (outer, inner, at, dir) => {
      for (let i = 0; i < outer; i++) {
        let run = [];
        let runColor = null;
        for (let j = 0; j <= inner; j++) {
          const [r, c] = at(i, j);
          const color = j < inner ? this.matchColor(r, c) : null;
          if (color && color === runColor) {
            run.push([r, c]);
            continue;
          }
          if (run.length >= 3) groups.push({ dir, color: runColor, cells: run });
          run = color ? [[r, c]] : [];
          runColor = color;
        }
      }
    };
    scan(this.rows, this.cols, (i, j) => [i, j], 'h');
    scan(this.cols, this.rows, (i, j) => [j, i], 'v');
    return groups;
  }

  // A swap that fires on its own, with no match needed: a color bomb with
  // anything, or two specials together.
  isComboSwap(a, b) {
    const x = this.get(...a), y = this.get(...b);
    if (!x || !y) return false;
    if (fixedPiece(x) || fixedPiece(y)) return false;
    if (x.special === BOMB || y.special === BOMB) return true;
    return Boolean(x.special && y.special);
  }

  locked(r, c) {
    return this.playable(r, c) && this.lock[r][c];
  }

  isValidSwap(a, b) {
    if (!Board.adjacent(a, b) || !this.get(...a) || !this.get(...b)) return false;
    if (this.locked(...a) || this.locked(...b)) return false;
    if (this.isComboSwap(a, b)) return true;
    this.swap(a, b);
    const ok = this.matchesAt(...a) || this.matchesAt(...b);
    this.swap(a, b);
    return ok;
  }

  // Swap and keep it only if it makes a match or a combo.
  trySwap(a, b) {
    if (!this.isValidSwap(a, b)) return false;
    this.swap(a, b);
    return true;
  }

  clear(cells) {
    const removed = [];
    for (const [r, c] of cells) {
      const cell = this.grid[r][c];
      if (cell) removed.push({ ...cell, candy: cell, at: [r, c] });
      this.grid[r][c] = null;
    }
    return removed;
  }

  // ---- resolving matches and specials ------------------------------------

  // One resolution step: explode lit wrapped candies, clear matches, make
  // new specials, and set off any specials caught in the blast. Mutates the
  // board and returns what happened, or null if there was nothing to do.
  //
  // `swap` is { from, to } on the first step after a player's swap, so new
  // specials land where the player moved and stripes follow the swipe.
  resolveStep(swap = null) {
    const pass = this.newPass();

    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++)
        if (this.grid[r][c]?.special === WRAPPED_LIT) this.mark(pass, r, c);

    const groups = this.findMatches();
    for (const cluster of clusterGroups(groups)) {
      const made = this.specialFor(cluster, swap);
      if (made) {
        pass.keep.add(key(made.at));
        pass.created.push(made);
      }
      for (const cell of cluster.cells) this.mark(pass, ...cell);
      for (const [r, c] of cluster.cells)
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) this.hitBlock(pass, r + dr, c + dc, -1);
    }

    if (!pass.clear.size && !pass.light.size && !pass.created.length && !pass.unlocked.size) return null;
    this.runPass(pass);
    return this.commit(pass, groups);
  }

  // Resolve a combo swap. Call after the board has been swapped: the candy
  // the player moved is now at `to`.
  comboStep(from, to) {
    const x = this.get(...to), y = this.get(...from);
    const pass = this.newPass();
    const [r, c] = to;
    const remove = (p) => pass.clear.set(key(p), p);

    if (x.special === BOMB || y.special === BOMB) {
      const bomb = x.special === BOMB ? to : from;
      const other = x.special === BOMB ? y : x;
      const otherAt = x.special === BOMB ? from : to;
      if (other.special === BOMB) {
        // Two bombs: clear the whole board.
        pass.blasts.push({ kind: 'board', at: to });
        remove(from);
        remove(to);
        for (let i = 0; i < this.rows; i++)
          for (let j = 0; j < this.cols; j++) {
            if (this.lock[i][j]) this.mark(pass, i, j);
            else if (this.grid[i][j] && this.grid[i][j].special !== INGREDIENT) remove([i, j]);
            this.hitBlock(pass, i, j, 0);
          }
      } else {
        remove(bomb);
        const targets = this.cellsOfColor(other.color).filter((p) => key(p) !== key(otherAt));
        this.startBlast(pass, { kind: 'bolts', at: bomb, targets });
        if (isStriped(other.special) || other.special === WRAPPED) {
          // Every candy of that color becomes the same special. They fire
          // one after another in firePrimed(), before anything falls.
          [otherAt, ...targets].forEach((p, i) => {
            const cand = this.get(...p);
            if (this.locked(...p)) return this.mark(pass, ...p); // the bolt only opens the lock
            if (!cand.special) {
              const special = other.special === WRAPPED ? WRAPPED
                : randInt(this.rng, 2) ? STRIPE_H : STRIPE_V;
              cand.special = special;
              pass.converted.push({ at: p, candy: cand, special });
            }
            cand.primed = i + 1;
          });
          pass.primed = true;
        } else {
          for (const p of [otherAt, ...targets]) this.mark(pass, ...p);
        }
      }
    } else if (isStriped(x.special) && isStriped(y.special)) {
      remove(from);
      remove(to);
      this.lineBlast(pass, 'row', r, to);
      this.lineBlast(pass, 'col', c, to);
    } else if (x.special === WRAPPED && y.special === WRAPPED) {
      remove(from);
      remove(to);
      this.areaBlast(pass, r, c, 2);
    } else {
      // Striped + wrapped: three rows and three columns.
      remove(from);
      remove(to);
      for (let d = -1; d <= 1; d++) {
        this.lineBlast(pass, 'row', r + d, to);
        this.lineBlast(pass, 'col', c + d, to);
      }
    }

    this.runPass(pass);
    return this.commit(pass, []);
  }

  // Set off the candies a bomb + special combo converted, in the order the
  // bolts reached them. Returns a step like resolveStep.
  firePrimed() {
    const primed = [];
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        const cand = this.grid[r][c];
        if (cand?.primed) primed.push({ at: [r, c], order: cand.primed });
      }
    if (!primed.length) return null;
    primed.sort((a, b) => a.order - b.order);
    const pass = this.newPass();
    for (const { at } of primed) {
      delete this.get(...at).primed;
      this.mark(pass, ...at);
    }
    this.runPass(pass);
    return this.commit(pass, []);
  }

  newPass() {
    return {
      clear: new Map(),   // key -> [r, c] to remove
      light: new Map(),   // key -> [r, c] wrapped candies that go lit
      keep: new Set(),    // keys that must survive this step
      queue: [],          // specials waiting to fire
      created: [],        // { at, color, special }
      converted: [],      // { at, candy, special } (bomb + special combos)
      blasts: [],         // effects for the renderer, in firing order
      blockHit: new Map(), // key -> { at, cause } coconuts cracked this step
      unlocked: new Map(), // key -> { at, cause } locks opened this step
      cause: new Map(),   // key -> index of the blast that cleared it (-1: the match)
      current: -1,
      primed: false,
    };
  }

  // Mark a cell for clearing. A special caught this way fires.
  mark(pass, r, c) {
    if (this.playable(r, c) && this.block[r][c]) {
      this.hitBlock(pass, r, c, pass.current);
      return;
    }
    const cand = this.get(r, c);
    const k = key([r, c]);
    if (!cand || cand.special === INGREDIENT) return;
    if (this.lock[r][c]) {
      // A hit opens the lock; the piece stays.
      if (!pass.unlocked.has(k)) pass.unlocked.set(k, { at: [r, c], cause: pass.current });
      return;
    }
    if (pass.keep.has(k) || pass.clear.has(k) || pass.light.has(k)) return;
    if (!pass.cause.has(k)) pass.cause.set(k, pass.current);
    if (cand.special === GUMMY) {
      pass.clear.set(k, [r, c]);
      return;
    }
    if (cand.special === WRAPPED) {
      pass.light.set(k, [r, c]);
      pass.queue.push([r, c]);
      return;
    }
    pass.clear.set(k, [r, c]);
    if (cand.special) pass.queue.push([r, c]);
  }

  // A coconut or mochi takes at most one hit per step. A match beside a
  // gummy cube pops it.
  hitBlock(pass, r, c, cause) {
    if (!this.playable(r, c)) return;
    if (this.grid[r][c]?.special === GUMMY) {
      const k = key([r, c]);
      if (!pass.clear.has(k)) {
        pass.clear.set(k, [r, c]);
        pass.cause.set(k, cause);
      }
      return;
    }
    if (!this.block[r][c]) return;
    const k = key([r, c]);
    if (!pass.blockHit.has(k)) pass.blockHit.set(k, { at: [r, c], cause });
  }

  // Record a blast; cells marked until the next one count as its victims.
  startBlast(pass, blast) {
    pass.current = pass.blasts.length;
    pass.blasts.push(blast);
  }

  // `origin` is where the beam starts, so the renderer can sweep it outward.
  lineBlast(pass, kind, index, origin) {
    if (kind === 'row' && (index < 0 || index >= this.rows)) return;
    if (kind === 'col' && (index < 0 || index >= this.cols)) return;
    this.startBlast(pass, { kind, index, at: [...origin] });
    const n = kind === 'row' ? this.cols : this.rows;
    for (let i = 0; i < n; i++) {
      if (kind === 'row') this.mark(pass, index, i);
      else this.mark(pass, i, index);
    }
  }

  areaBlast(pass, r, c, radius) {
    this.startBlast(pass, { kind: 'area', at: [r, c], radius });
    for (let i = r - radius; i <= r + radius; i++)
      for (let j = c - radius; j <= c + radius; j++) this.mark(pass, i, j);
  }

  // Fire queued specials until nothing new is set off.
  runPass(pass) {
    while (pass.queue.length) {
      const [r, c] = pass.queue.shift();
      const cand = this.get(r, c);
      if (!cand) continue;
      const fired = pass.blasts.length;
      switch (cand.special) {
        case STRIPE_H:
          this.lineBlast(pass, 'row', r, [r, c]);
          break;
        case STRIPE_V:
          this.lineBlast(pass, 'col', c, [r, c]);
          break;
        case WRAPPED:
        case WRAPPED_LIT:
          this.areaBlast(pass, r, c, 1);
          break;
        case BOMB: {
          // A bomb caught in a blast takes out the most common color.
          const color = this.mostCommonColor(pass);
          if (!color) break;
          const targets = this.cellsOfColor(color).filter((p) => !pass.clear.has(key(p)));
          this.startBlast(pass, { kind: 'bolts', at: [r, c], targets });
          for (const p of targets) this.mark(pass, ...p);
          break;
        }
      }
      // A special leaves the board the moment it goes off.
      if (pass.blasts.length > fired) pass.cause.set(key([r, c]), fired);
    }
  }

  commit(pass, groups) {
    const cleared = this.clear([...pass.clear.values()]).map((x) => ({
      ...x,
      cause: pass.cause.get(key(x.at)) ?? -1,
    }));
    for (const [r, c] of pass.light.values()) this.grid[r][c].special = WRAPPED_LIT;
    for (const made of pass.created) {
      const [r, c] = made.at;
      const cand = this.grid[r][c];
      cand.special = made.special;
      if (made.special === BOMB) cand.color = null;
      delete cand.timer; // a timer fruit that becomes a special is safe
      made.candy = cand;
    }
    // Jelly comes off every cell that was matched or blasted, including
    // where a new special formed and under a wrapped candy that went off.
    const jellyHit = [];
    const hitCells = [...cleared.map((x) => x.at), ...pass.light.values(), ...pass.created.map((m) => m.at)];
    const seen = new Set();
    for (const [r, c] of hitCells) {
      const k = key([r, c]);
      if (seen.has(k) || this.jelly[r][c] <= 0) continue;
      seen.add(k);
      this.jelly[r][c]--;
      jellyHit.push({ at: [r, c], left: this.jelly[r][c] });
    }

    const blocksHit = [];
    for (const { at, cause } of pass.blockHit.values()) {
      const [r, c] = at;
      this.block[r][c]--;
      blocksHit.push({ at, cause, left: this.block[r][c], type: this.blockType[r][c] });
      if (!this.block[r][c]) this.blockType[r][c] = null;
    }

    const unlocked = [...pass.unlocked.values()];
    for (const { at } of unlocked) this.lock[at[0]][at[1]] = false;

    const matched = new Set(groups.flatMap((g) => g.cells.map(key)));
    const blasted = cleared.filter((x) => !matched.has(key(x.at))).length;
    const points =
      scoreFor(groups, 1) +
      pass.created.length * POINTS_PER_SPECIAL_MADE +
      blasted * POINTS_PER_BLASTED_CANDY +
      jellyHit.length * POINTS_PER_JELLY +
      blocksHit.length * POINTS_PER_COCONUT_HIT +
      unlocked.length * POINTS_PER_LOCK +
      cleared.filter((x) => x.timer != null).length * POINTS_PER_TIMER;
    return {
      groups,
      cleared,
      lit: [...pass.light.values()],
      created: pass.created,
      converted: pass.converted,
      blasts: pass.blasts,
      primed: pass.primed,
      jellyHit,
      blocksHit,
      unlocked,
      points,
    };
  }

  // Which special a cluster of same-color runs makes, and where.
  specialFor(cluster, swap) {
    const longest = cluster.groups.reduce((a, g) => (g.cells.length > a.cells.length ? g : a));
    const n = longest.cells.length;
    if (n >= 5) {
      return this.placeSpecial(cluster.color, BOMB, swap, longest.cells[n >> 1], longest.cells);
    }
    const hasH = cluster.groups.some((g) => g.dir === 'h');
    const hasV = cluster.groups.some((g) => g.dir === 'v');
    if (hasH && hasV) {
      return this.placeSpecial(cluster.color, WRAPPED, swap, cluster.intersection, cluster.cells);
    }
    if (n === 4) {
      // Stripes follow the swipe. From a cascade, they run across the match.
      const special = swap
        ? (swap.from[0] === swap.to[0] ? STRIPE_H : STRIPE_V)
        : (longest.dir === 'h' ? STRIPE_V : STRIPE_H);
      return this.placeSpecial(cluster.color, special, swap, longest.cells[1], longest.cells);
    }
    return null;
  }

  // Put the new special where the player swapped if that cell is part of
  // the match, otherwise at the preferred cell. Avoid a cell that already
  // holds a special, so that one still gets to fire.
  placeSpecial(color, special, swap, preferred, allowed) {
    const ok = (p) => p && allowed.some((q) => q[0] === p[0] && q[1] === p[1]) && !this.get(...p).special && !this.lock[p[0]][p[1]];
    const at = [swap?.to, swap?.from, preferred, ...allowed].find(ok);
    return at ? { at: [...at], color, special } : null;
  }

  cellsOfColor(color) {
    const out = [];
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) if (this.matchColor(r, c) === color) out.push([r, c]);
    return out;
  }

  mostCommonColor(pass) {
    const counts = new Map();
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        const color = this.matchColor(r, c);
        if (color && !pass.clear.has(key([r, c]))) counts.set(color, (counts.get(color) ?? 0) + 1);
      }
    let best = null, n = 0;
    for (const [color, count] of counts) if (count > n) [best, n] = [color, count];
    return best;
  }

  // ---- gravity ------------------------------------------------------------

  // Drop candies straight down into empty cells, skipping cells outside the
  // board. Returns [{ id, from, to }] for the renderer.
  // Pieces fall straight down, but never through a coconut. A gap under a
  // coconut can't be fed from the top, so a piece slides into it
  // diagonally from a neighboring column. Returns one move per piece that
  // moved, from where it was to where it ended up.
  applyGravity() {
    const moved = new Map();
    const move = (cell, from, to, via = []) => {
      const m = moved.get(cell.id);
      if (m) {
        m.to = to;
        if (via.length) m.via = [...(m.via ?? []), ...via];
      } else {
        moved.set(cell.id, via.length ? { id: cell.id, from, to, via } : { id: cell.id, from, to });
      }
    };
    for (let guard = 0; guard < 1000; guard++) {
      this.compact(move);
      if (!this.slideOne(move)) break;
    }
    return [...moved.values()].filter((m) => m.from[0] !== m.to[0] || m.from[1] !== m.to[1]);
  }

  // The paths pieces fall along, each a list of cells from the bottom up.
  // With no portals a path is one column (cells off the board are
  // see-through, so pieces drop past gaps in the shape). A portal cuts its
  // column below `from` and above `to`, and joins the two parts: the path
  // runs up to `to`, then goes on from `from`. `sky` says if new pieces can
  // drop in at the top; `joins` lists where the path goes through a portal.
  fallPaths() {
    if (this.paths) return this.paths;
    const ins = new Map(this.portals.map((p) => [key(p.from), p]));
    const outs = new Map(this.portals.map((p) => [key(p.to), p]));
    const parts = [];
    for (let c = 0; c < this.cols; c++) {
      let part = null, first = true;
      for (let r = 0; r < this.rows; r++) {
        if (!this.mask[r][c]) continue;
        const k = key([r, c]);
        if (!part || outs.has(k)) parts.push(part = { cells: [], col: c, sky: first && !outs.has(k) });
        part.cells.unshift([r, c]);
        first = false;
        if (ins.has(k)) part = null;
      }
    }
    const top = (part) => part.cells[part.cells.length - 1];
    const partWithBottom = new Map(parts.map((p) => [key(p.cells[0]), p]));
    const upper = new Set(this.portals.map((p) => partWithBottom.get(key(p.from))));
    const paths = [];
    for (const start of parts) {
      if (upper.has(start)) continue; // reached through the portal below it
      const path = { cells: [], joins: [], sky: false, col: start.col };
      for (let part = start, guard = 0; part && guard < 20; guard++) {
        path.cells.push(...part.cells);
        path.sky = part.sky;
        path.col = part.col;
        const portal = outs.get(key(top(part)));
        if (!portal) break;
        path.joins.push({ index: path.cells.length, portal });
        part = partWithBottom.get(key(portal.from));
      }
      paths.push(path);
    }
    const where = new Map();
    for (const path of paths) path.cells.forEach((cell, i) => where.set(key(cell), { path, i }));
    this.paths = Object.assign(paths, { where });
    return this.paths;
  }

  // Does something in this cell stop pieces from falling past it?
  barrier(r, c) {
    return this.block[r][c] > 0 || this.lock[r][c];
  }

  // Straight down along each path, within each stretch between barriers
  // (coconuts, mochi and locked pieces).
  compact(move) {
    for (const path of this.fallPaths()) {
      const { cells } = path;
      let seg = [];
      const flush = () => {
        let write = 0;
        for (const i of seg) {
          const [r, c] = cells[i];
          const cell = this.grid[r][c];
          if (!cell) continue;
          const t = seg[write++];
          if (t !== i) {
            const [tr, tc] = cells[t];
            this.grid[tr][tc] = cell;
            this.grid[r][c] = null;
            // The portals it went through, in the order it met them.
            const via = path.joins.filter((j) => j.index > t && j.index <= i).map((j) => j.portal).reverse();
            move(cell, [r, c], [tr, tc], via);
          }
        }
        seg = [];
      };
      cells.forEach(([r, c], i) => {
        if (this.barrier(r, c)) flush();
        else seg.push(i);
      });
      flush();
    }
  }

  // Can new pieces drop into this cell from above the board?
  fed(r, c) {
    const { path, i } = this.fallPaths().where.get(key([r, c]));
    if (!path.sky) return false;
    for (let j = i + 1; j < path.cells.length; j++) if (this.barrier(...path.cells[j])) return false;
    return true;
  }

  // The empty cells at the top of each path that new pieces can drop into:
  // [{ path, cells }], cells from the top down, by the column they enter.
  fedGaps() {
    const out = [];
    for (const path of this.fallPaths()) {
      if (!path.sky) continue;
      const cells = [];
      for (let i = path.cells.length - 1; i >= 0; i--) {
        const [r, c] = path.cells[i];
        if (this.barrier(r, c)) break;
        if (!this.grid[r][c]) cells.push({ at: [r, c], via: path.joins.filter((j) => j.index > i).map((j) => j.portal).reverse() });
      }
      if (cells.length) out.push({ path, cells });
    }
    return out.sort((a, b) => a.path.col - b.path.col);
  }

  // Slide one piece diagonally down into the lowest gap that can't be fed.
  slideOne(move) {
    for (let r = this.rows - 1; r > 0; r--)
      for (let c = 0; c < this.cols; c++) {
        if (!this.mask[r][c] || this.barrier(r, c) || this.grid[r][c] || this.fed(r, c)) continue;
        for (const dc of [-1, 1]) {
          const sr = r - 1, sc = c + dc;
          if (!this.playable(sr, sc) || this.barrier(sr, sc)) continue;
          const cell = this.grid[sr][sc];
          if (!cell) continue;
          this.grid[r][c] = cell;
          this.grid[sr][sc] = null;
          move(cell, [sr, sc], [r, c]);
          return true;
        }
      }
    return false;
  }

  // Empty cells that new pieces can drop into.
  hasGaps() {
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++)
        if (this.mask[r][c] && !this.block[r][c] && !this.grid[r][c]) return true;
    return false;
  }

  blockCount() {
    let n = 0;
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.mask[r][c]) n += this.block[r][c];
    return n;
  }

  // Fill empty cells from the top. Each spawn says how many rows above the
  // board it starts, so a column's new candies stack up and fall in together.
  // A piece bound for a cell past a portal says so with `via`, and `col` is
  // the column it drops into.
  refill() {
    const spawns = [];
    const ingredientCol = this.pickIngredientColumn();
    for (const { path, cells } of this.fedGaps()) {
      const c = path.col;
      const spout = this.dispensers.find((d) => d.col === c);
      let dispensed = null;
      if (spout) {
        spout.n = (spout.n ?? 0) + 1;
        if (spout.n % spout.every === 0) dispensed = this.dispense(spout.kind);
      }
      cells.forEach(({ at, via }, i) => {
        // The last piece in drops first, so it leads the column down.
        const cell = dispensed && i === cells.length - 1 ? dispensed
          : c === ingredientCol && i === 0 ? this.newIngredient(this.nextIngredientKind())
          : this.newCandy(this.randomColor());
        if (this.timerDue && !cell.special && this.timerCount() < this.timerRule.max) {
          // The count starts to go down on the next move.
          Object.assign(cell, { timer: this.timerRule.fuse, fresh: true });
          this.timerDue = false;
        }
        this.grid[at[0]][at[1]] = cell;
        const spawn = { id: cell.id, candy: cell, color: cell.color, to: at, fromRow: i - cells.length, dispensed: cell === dispensed };
        if (via.length) Object.assign(spawn, { via, col: c });
        spawns.push(spawn);
      });
    }
    return spawns;
  }

  // What a dispenser drops in.
  dispense(kind) {
    switch (kind) {
      case 'bomb': return this.newCandy(null, BOMB);
      case 'wrapped': return this.newCandy(this.randomColor(), WRAPPED);
      case 'gummy': return this.newCandy(null, GUMMY);
      default: return this.newCandy(this.randomColor(), randInt(this.rng, 2) ? STRIPE_H : STRIPE_V);
    }
  }

  gummyCount() {
    let n = 0;
    for (const row of this.grid) for (const c of row) if (c?.special === GUMMY) n++;
    return n;
  }

  // On ingredient levels, sometimes drop a new one in with the refill.
  pickIngredientColumn() {
    const sp = this.spawner;
    if (!sp || sp.remaining <= 0 || this.countIngredients() >= sp.maxOnBoard) return -1;
    if (this.rng() >= sp.chance) return -1;
    const cols = this.fedGaps().map((g) => g.path.col);
    if (!cols.length) return -1;
    sp.remaining--;
    return cols[randInt(this.rng, cols.length)];
  }

  nextIngredientKind() {
    this.ingredientsMade = (this.ingredientsMade ?? 0) + 1;
    return INGREDIENT_KINDS[this.ingredientsMade % INGREDIENT_KINDS.length];
  }

  countIngredients() {
    let n = 0;
    for (const row of this.grid) for (const c of row) if (c?.special === INGREDIENT) n++;
    return n;
  }

  // Put `n` ingredients along the top at the start of a level.
  placeIngredients(n) {
    const cols = [];
    for (let c = 0; c < this.cols; c++) if (this.topRow(c) >= 0 && !this.block[this.topRow(c)][c]) cols.push(c);
    for (let i = 0; i < n && cols.length; i++) {
      const c = cols.splice(randInt(this.rng, cols.length), 1)[0];
      this.grid[this.topRow(c)][c] = this.newIngredient(this.nextIngredientKind());
    }
  }

  topRow(c) {
    for (let r = 0; r < this.rows; r++) if (this.mask[r][c]) return r;
    return -1;
  }

  // The lowest cell of every falling path is an exit. (With no portals,
  // that is every column's lowest cell.)
  setExits() {
    this.exits.clear();
    for (const path of this.fallPaths()) this.exits.add(key(path.cells[0]));
  }

  isExit(r, c) {
    return this.exits.has(key([r, c]));
  }

  // Take away ingredients sitting on an exit. Returns [{ candy, at }].
  collectIngredients() {
    const out = [];
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        const cand = this.grid[r][c];
        if (cand?.special === INGREDIENT && this.isExit(r, c)) {
          this.grid[r][c] = null;
          out.push({ id: cand.id, candy: cand, at: [r, c] });
        }
      }
    return out;
  }

  // ---- jam -----------------------------------------------------------------

  jamCount() {
    let n = 0;
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) if (this.block[r][c] && this.blockType[r][c] === 'jam') n++;
    return n;
  }

  // Jam grows by one cell: it covers a fruit next to it, and the fruit is
  // gone. It takes a plain fruit if it can, a special if it must, and never
  // a locked fruit, a timer fruit, an ingredient or a gummy. Returns
  // { from, to, eaten }, or null if no jam has room to grow.
  spreadJam() {
    const plain = [], special = [];
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        if (!this.block[r][c] || this.blockType[r][c] !== 'jam') continue;
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const to = [r + dr, c + dc];
          const cell = this.get(...to);
          if (!cell || fixedPiece(cell) || this.lock[to[0]][to[1]] || cell.timer != null) continue;
          (cell.special ? special : plain).push({ from: [r, c], to });
        }
      }
    const options = plain.length ? plain : special;
    if (!options.length) return null;
    const { from, to } = options[randInt(this.rng, options.length)];
    const eaten = this.grid[to[0]][to[1]];
    this.grid[to[0]][to[1]] = null;
    this.block[to[0]][to[1]] = 1;
    this.blockType[to[0]][to[1]] = 'jam';
    return { from, to, eaten };
  }

  // ---- timer fruit ---------------------------------------------------------

  timerCount() {
    let n = 0;
    for (const row of this.grid) for (const c of row) if (c?.timer != null) n++;
    return n;
  }

  // Put `n` timer fruit on the board at the start of a level, away from
  // the bottom rows so each one takes some work to reach.
  placeTimers(n, fuse) {
    const cells = [];
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (cell && !cell.special && !this.lock[r][c]) cells.push([r, c]);
      }
    for (let i = 0; i < n && cells.length; i++) {
      const [r, c] = cells.splice(randInt(this.rng, cells.length), 1)[0];
      this.grid[r][c].timer = fuse;
    }
  }

  // One move went by: every timer fruit counts down by one. A fruit that
  // dropped in during this move starts to count on the next one. Returns
  // { ticked: [{ id, at, left }], exploded: [{ id, at }] }.
  tickTimers() {
    const ticked = [], exploded = [];
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (cell?.timer == null) continue;
        if (cell.fresh) {
          delete cell.fresh;
          continue;
        }
        cell.timer--;
        ticked.push({ id: cell.id, at: [r, c], left: cell.timer });
        if (cell.timer <= 0) exploded.push({ id: cell.id, at: [r, c] });
      }
    return { ticked, exploded };
  }

  // The level is won: every timer stops. Returns the ids of the fruit.
  defuseAll() {
    const ids = [];
    for (const row of this.grid)
      for (const cell of row)
        if (cell?.timer != null) {
          delete cell.timer;
          delete cell.fresh;
          ids.push(cell.id);
        }
    return ids;
  }

  jellyCount() {
    let n = 0;
    for (const row of this.jelly) for (const j of row) if (j > 0) n++;
    return n;
  }

  // The Smash booster: knock out one piece. A special hit this way goes
  // off as if a blast caught it. Returns a step, or null for a cell that
  // can't be smashed (empty, off the board, or an ingredient).
  smashStep(at) {
    const cand = this.get(...at);
    const coconut = this.playable(...at) && this.block[at[0]][at[1]] > 0;
    if (!coconut && (!cand || cand.special === INGREDIENT)) return null;
    const pass = this.newPass();
    this.startBlast(pass, { kind: 'smash', at: [...at] });
    this.mark(pass, ...at);
    this.runPass(pass);
    return this.commit(pass, []);
  }

  // The Sweep booster: clear the whole row and the whole column of a cell.
  // Works on any cell of the board. Returns a step.
  sweepStep(at) {
    if (!this.playable(...at)) return null;
    const pass = this.newPass();
    this.lineBlast(pass, 'row', at[0], at);
    this.lineBlast(pass, 'col', at[1], at);
    this.runPass(pass);
    return this.commit(pass, []);
  }

  // The Picker booster: take every fruit of the kind in this cell. Returns
  // a step, or null for a cell with no fruit kind (empty, a color bomb, an
  // ingredient, a blocker).
  pickStep(at) {
    const color = this.playable(...at) ? this.matchColor(...at) : null;
    if (!color) return null;
    const pass = this.newPass();
    const targets = [at, ...this.cellsOfColor(color).filter((p) => key(p) !== key(at))];
    this.startBlast(pass, { kind: 'bolts', at: [...at], targets });
    for (const p of targets) this.mark(pass, ...p);
    this.runPass(pass);
    return this.commit(pass, []);
  }

  // The Switch booster: swap any two neighbors, match or not.
  canSwitch(a, b) {
    return Board.adjacent(a, b) && !!this.get(...a) && !!this.get(...b) && !this.locked(...a) && !this.locked(...b);
  }

  // End-of-level bonus: turn `n` plain candies into stripes, and prime them
  // along with every special already on the board to fire in firePrimed().
  // Returns a step for the renderer, or null if there's nothing to fire.
  primeBonus(n) {
    const plain = [], specials = [];
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        const cand = this.grid[r][c];
        if (!cand || fixedPiece(cand) || cand.special === WRAPPED_LIT || this.lock[r][c]) continue;
        (cand.special ? specials : plain).push([r, c]);
      }
    const converted = [];
    for (let i = 0; i < n && plain.length; i++) {
      const at = plain.splice(randInt(this.rng, plain.length), 1)[0];
      const cand = this.get(...at);
      cand.special = randInt(this.rng, 2) ? STRIPE_H : STRIPE_V;
      converted.push({ at, candy: cand, special: cand.special });
    }
    const all = [...converted.map((x) => x.at), ...specials];
    if (!all.length) return null;
    all.forEach((at, i) => (this.get(...at).primed = i + 1));
    return {
      groups: [], cleared: [], lit: [], created: [], converted, blasts: [],
      primed: true, jellyHit: [], points: 0, bonus: true,
    };
  }

  findPossibleMove() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.get(r, c)) continue;
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const a = [r, c], b = [r + dr, c + dc];
          if (this.isValidSwap(a, b)) return [a, b];
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
      for (let c = 0; c < this.cols; c++)
        if (this.grid[r][c] && !fixedPiece(this.grid[r][c]) && !this.lock[r][c]) cells.push([r, c]);
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
    this.fillInitial(true);
    return null;
  }
}

function key([r, c]) {
  return r * 100 + c;
}

// Group runs of the same color that share a cell (an L, T or plus shape is
// one cluster made of an h-run and a v-run).
function clusterGroups(groups) {
  const parent = groups.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const owner = new Map();
  groups.forEach((g, i) => {
    for (const cell of g.cells) {
      const k = key(cell);
      if (owner.has(k)) {
        const j = owner.get(k);
        if (groups[j].color === g.color) parent[find(i)] = find(j);
      } else {
        owner.set(k, i);
      }
    }
  });
  const byRoot = new Map();
  groups.forEach((g, i) => {
    const root = find(i);
    if (!byRoot.has(root)) byRoot.set(root, []);
    byRoot.get(root).push(g);
  });
  return [...byRoot.values()].map((gs) => {
    const cells = new Map();
    const seen = new Map();
    let intersection = null;
    for (const g of gs)
      for (const cell of g.cells) {
        const k = key(cell);
        if (seen.has(k) && seen.get(k) !== g.dir) intersection = cell;
        seen.set(k, g.dir);
        cells.set(k, cell);
      }
    return { color: gs[0].color, groups: gs, cells: [...cells.values()], intersection };
  });
}

// Points for the matched runs in one step. Bigger runs are worth more, and
// each cascade after the first multiplies the step.
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
