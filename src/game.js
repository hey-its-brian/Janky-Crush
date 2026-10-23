// Plays one level: takes swaps, runs each turn's events (from
// engine/turn.js) through the renderer one at a time, and ends the level
// with the bonus round. Also owns touch input.

import { Board } from './engine/board.js';
import { setupBoard, LevelState } from './engine/level.js';
import { playTurn, bonusRound } from './engine/turn.js';
import { Renderer, BONUS_GAP_MAX, BONUS_TOTAL_MAX } from './render/renderer.js';
import { makeRng } from './rng.js';

const HINT_AFTER_MS = 6000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class Game {
  // onChange(hud) after anything the HUD shows changes; onBanner(text) to
  // flash a big message; onEnd(result) when the level is over.
  constructor(canvas, { onChange, onBanner, onEnd }) {
    this.canvas = canvas;
    this.onChange = onChange;
    this.onBanner = onBanner;
    this.onEnd = onEnd;
    this.busy = false;
    this.over = true;
    this.bindInput();
  }

  // Start (or restart) a level. Returns false if a turn is still playing.
  start(level) {
    if (this.busy) return false;
    this.level = level;
    this.board = setupBoard(level, makeRng());
    this.state = new LevelState(level, this.board);
    if (this.renderer) {
      this.renderer.board = this.board;
      this.renderer.setSelected(null);
      this.renderer.setHint(null);
      this.renderer.resize();
      this.renderer.sync();
    } else {
      this.renderer = new Renderer(this.canvas, this.board);
    }
    this.over = false;
    this.selected = null;
    this.movesShown = null;
    this.emit();
    this.armHint();
    return true;
  }

  get moves() {
    return this.state?.moves ?? 0;
  }

  get score() {
    return this.state?.score ?? 0;
  }

  emit() {
    const s = this.state;
    this.onChange({
      moves: this.movesShown ?? s.moves,
      score: s.score,
      stars: s.level.stars.filter((t) => s.score >= t).length,
      goal: s.goal.type,
      jellyLeft: s.jellyLeft(),
      ingredientsLeft: s.ingredientsLeft(),
    });
  }

  resize() {
    this.renderer?.resize();
  }

  // ---- turn ---------------------------------------------------------------

  async attemptSwap(a, b) {
    if (this.busy || this.over || !Board.adjacent(a, b)) return;
    if (!this.board.get(...a) || !this.board.get(...b)) return;
    this.busy = true;
    this.select(null);
    this.renderer.setHint(null);
    clearTimeout(this.hintTimer);

    const r = this.renderer;
    if (!this.board.isValidSwap(a, b)) {
      await r.animateBadSwap(a, b);
      this.busy = false;
      this.armHint();
      return;
    }

    await r.animateSwap(a, b);
    await this.run(playTurn(this.board, this.state, a, b));

    if (this.state.isOver()) {
      await this.finish();
      this.busy = false;
      return;
    }
    this.busy = false;
    this.armHint();
  }

  // Animate each event before letting the engine compute the next.
  async run(events) {
    const r = this.renderer;
    for (const ev of events) {
      this.emit();
      switch (ev.type) {
        case 'step':
          if (ev.step.bonus) this.countDownMoves(ev.step.converted.length);
          await r.animateStep(ev.step, ev.points);
          break;
        case 'fall':
          await r.animateFall(ev.falls, ev.spawns);
          break;
        case 'collect':
          await r.animateCollect(ev.items, ev.points);
          break;
        case 'shuffle':
          await r.animateShuffle(ev.moves);
          break;
      }
    }
    this.emit();
  }

  // In the bonus round the moves counter ticks down as each leftover move
  // turns into a stripe.
  countDownMoves(n) {
    if (!n) return;
    const gap = Math.min(BONUS_GAP_MAX, BONUS_TOTAL_MAX / n);
    for (let i = 0; i <= n; i++) {
      setTimeout(() => {
        this.movesShown = n - i;
        this.emit();
        if (i === n) this.movesShown = null;
      }, i * gap);
    }
  }

  // Goal met (or a score level's moves are spent): celebrate, turn leftover
  // moves into stripes and fire everything, then report the result.
  async finish() {
    this.over = true;
    const s = this.state;
    const celebrate = s.isComplete() || (s.goal.type === 'score' && s.score >= s.level.stars[0]);
    if (celebrate) {
      this.onBanner('Janky Crush!');
      await sleep(1100);
    }
    // Score levels fire whatever specials are left either way.
    if (celebrate || s.goal.type === 'score') await this.run(bonusRound(this.board, s));
    this.onEnd({
      won: s.won(),
      stars: s.stars(),
      score: s.score,
      goal: s.goal.type,
      jellyLeft: s.jellyLeft(),
      ingredientsLeft: s.ingredientsLeft(),
      target: s.level.stars[0],
    });
  }

  armHint() {
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => {
      if (!this.busy && !this.over) this.renderer.setHint(this.board.findPossibleMove());
    }, HINT_AFTER_MS);
  }

  stop() {
    clearTimeout(this.hintTimer);
    this.over = true;
    this.renderer?.setHint(null);
    this.renderer?.setSelected(null);
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
