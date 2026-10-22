// The turn loop: take a swap, then clear → fall → refill until the board
// settles, animating each step. Also owns touch input.

import { Board, scoreFor, uniqueCells } from './engine/board.js';
import { Renderer } from './render/renderer.js';

const HINT_AFTER_MS = 6000;

export class Game {
  constructor(canvas, level, { onChange, onEnd }) {
    this.canvas = canvas;
    this.level = level;
    this.onChange = onChange;
    this.onEnd = onEnd;
    this.bindInput();
    this.start();
  }

  start() {
    // A turn mid-animation still holds the old board; let it finish first.
    if (this.busy) return false;
    this.board = new Board({ rows: this.level.rows, cols: this.level.cols, mask: this.level.mask });
    this.board.fillInitial();
    if (this.renderer) {
      this.renderer.board = this.board;
      this.renderer.setSelected(null);
      this.renderer.setHint(null);
      this.renderer.sync();
    } else {
      this.renderer = new Renderer(this.canvas, this.board);
    }
    this.moves = this.level.moves;
    this.score = 0;
    this.busy = false;
    this.over = false;
    this.selected = null;
    this.emit();
    this.armHint();
  }

  emit() {
    this.onChange({ moves: this.moves, score: this.score, stars: this.stars() });
  }

  stars() {
    return this.level.stars.filter((s) => this.score >= s).length;
  }

  resize() {
    this.renderer.resize();
  }

  // ---- turn ---------------------------------------------------------------

  async attemptSwap(a, b) {
    if (this.busy || this.over || !Board.adjacent(a, b)) return;
    this.busy = true;
    this.select(null);
    this.renderer.setHint(null);
    clearTimeout(this.hintTimer);

    const r = this.renderer;
    if (!this.board.get(...a) || !this.board.get(...b)) {
      this.busy = false;
      return;
    }
    // Check the swap on a scratch swap first so the animation knows which
    // way to go.
    this.board.swap(a, b);
    const ok = this.board.matchesAt(...a) || this.board.matchesAt(...b);
    this.board.swap(a, b);

    if (!ok) {
      await r.animateBadSwap(a, b);
      this.busy = false;
      this.armHint();
      return;
    }

    await r.animateSwap(a, b);
    this.board.swap(a, b);
    this.moves--;
    this.emit();

    for (let cascade = 1; ; cascade++) {
      const groups = this.board.findMatches();
      if (!groups.length) break;
      const points = scoreFor(groups, cascade);
      this.score += points;
      const removed = this.board.clear(uniqueCells(groups));
      this.emit();
      await r.animateClear(removed, groups, points);
      const falls = this.board.applyGravity();
      const spawns = this.board.refill();
      await r.animateFall(falls, spawns);
    }

    if (!this.board.findPossibleMove()) {
      await r.animateShuffle(this.board.shuffle());
    }

    this.busy = false;
    if (this.moves <= 0) {
      this.over = true;
      this.onEnd({ score: this.score, stars: this.stars(), won: this.stars() > 0 });
      return;
    }
    this.armHint();
  }

  armHint() {
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => {
      if (!this.busy && !this.over) this.renderer.setHint(this.board.findPossibleMove());
    }, HINT_AFTER_MS);
  }

  select(cell) {
    this.selected = cell;
    this.renderer.setSelected(cell);
  }

  // ---- input --------------------------------------------------------------

  bindInput() {
    const c = this.canvas;
    let start = null;

    const local = (e) => {
      const rect = c.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    c.addEventListener('pointerdown', (e) => {
      if (this.busy || this.over) return;
      const p = local(e);
      const cell = this.renderer.cellAt(p.x, p.y);
      if (!cell) return;
      c.setPointerCapture(e.pointerId);
      start = { ...p, cell, swiped: false };
      this.renderer.setHint(null);
      this.armHint();
    });

    c.addEventListener('pointermove', (e) => {
      if (!start || start.swiped) return;
      const p = local(e);
      const dx = p.x - start.x, dy = p.y - start.y;
      const threshold = this.renderer.pitch * 0.35;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
      start.swiped = true;
      const [r, col] = start.cell;
      const target = Math.abs(dx) > Math.abs(dy) ? [r, col + Math.sign(dx)] : [r + Math.sign(dy), col];
      if (this.board.playable(...target)) this.attemptSwap(start.cell, target);
    });

    const end = () => {
      if (!start) return;
      if (!start.swiped) {
        const cell = start.cell;
        const sel = this.selected;
        if (sel && sel[0] === cell[0] && sel[1] === cell[1]) this.select(null);
        else if (sel && Board.adjacent(sel, cell)) this.attemptSwap(sel, cell);
        else this.select(cell);
      }
      start = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', () => (start = null));
  }
}
