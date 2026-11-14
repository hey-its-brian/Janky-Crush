// Plays one level: takes swaps, runs each turn's events (from
// engine/turn.js) through the renderer one at a time, and ends the level
// with the bonus round. Also owns touch input and the in-level boosters
// (Smash, Switch, Shuffle, Sweep, Picker); paying for things is up to the
// caller.

import { Board } from './engine/board.js';
import { setupBoard, LevelState } from './engine/level.js';
import { playTurn, bonusRound, playSmash, playSwitch, playSweep, playPick } from './engine/turn.js';
import { Renderer, BONUS_GAP_MAX, BONUS_TOTAL_MAX } from './render/renderer.js';
import { makeRng } from './rng.js';
import { play } from './audio/sfx.js';
import { haptic } from './audio/haptics.js';

// Which sounds also get a haptic tap, and how strong.
const HAPTIC = { squish: 1, crack: 1, smash: 2, match: 1, swap: 1, boing: 1, zap: 1, boom: 2, bolt: 1, splash: 2, sparkle: 1 };

const HINT_AFTER_MS = 6000;
// Callouts as a chain grows (cascade number → word).
const CHAIN_WORDS = { 3: 'Juicy!', 5: 'Fresh!', 7: 'Tropical!', 9: 'Smoothie!' };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Boosters that the player aims with one tap on a cell.
const TAP_AIMED = ['smash', 'sweep', 'pick'];

export class Game {
  // onChange(hud) after anything the HUD shows changes; onBanner(text) to
  // flash a big message; onCallout(text) for a combo shout; onEnd(result)
  // when the level is over. onOutOfMoves() resolves to a number of extra
  // moves (0 to give up). onBooster(name) after a booster has been used.
  constructor(canvas, { onChange, onBanner, onCallout = () => {}, onEnd, onOutOfMoves = async () => 0, onBooster = () => {}, onCleared = () => {} }) {
    this.canvas = canvas;
    this.onChange = onChange;
    this.onBanner = onBanner;
    this.onCallout = onCallout;
    this.onEnd = onEnd;
    this.onOutOfMoves = onOutOfMoves;
    this.onBooster = onBooster;
    this.onCleared = onCleared; // each fruit as it pops: { color, x, y } on the canvas
    this.armed = null; // a booster's name while it waits for the player to aim it
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
      this.renderer.cue = (name, opts) => {
        if (name === 'cleared') {
          if (!this.state.inBonus) this.onCleared(opts);
          return;
        }
        play(name, opts);
        if (HAPTIC[name]) haptic(HAPTIC[name]);
      };
    }
    this.over = false;
    this.started = false; // has a move been made (quitting then costs a life)
    this.armed = null;
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
      blockersLeft: s.blockersLeft(),
      collectLeft: s.collectLeft(),
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
    if (this.board.locked(...a) || this.board.locked(...b)) {
      // A locked fruit does not move: its cage rattles.
      r.rattle(this.board.locked(...a) ? a : b);
      this.busy = false;
      this.armHint();
      return;
    }
    if (!this.board.isValidSwap(a, b)) {
      await r.animateBadSwap(a, b);
      this.busy = false;
      this.armHint();
      return;
    }

    if (this.board.isComboSwap(a, b)) this.comboShout = true;
    this.started = true;
    await r.animateSwap(a, b);
    await this.run(playTurn(this.board, this.state, a, b));
    await this.afterTurn();
  }

  // After a turn or a booster: out of moves means offering more, then
  // finishing; otherwise wait for the next swap.
  async afterTurn() {
    const s = this.state;
    if (s.moves <= 0 && !s.exploded && !s.isComplete() && !(s.goal.type === 'score' && s.score >= s.level.stars[0])) {
      const extra = await this.onOutOfMoves();
      if (extra > 0) {
        s.moves += extra;
        this.emit();
      }
    }
    if (s.isOver()) {
      await this.finish();
      this.busy = false;
      return;
    }
    this.busy = false;
    this.armHint();
  }

  // ---- boosters -------------------------------------------------------------

  // Get a booster ready. Shuffle goes straight away; Smash and Switch wait
  // for the player to aim them (call again with null to cancel). Returns
  // whether it was accepted.
  arm(name) {
    if (this.busy || this.over) return false;
    this.select(null);
    this.renderer.setHint(null);
    if (name === 'shuffle') {
      this.armed = null;
      this.useShuffle();
      return true;
    }
    this.armed = name;
    this.renderer.setAiming(name);
    return true;
  }

  disarm() {
    this.armed = null;
    this.renderer?.setAiming(null);
  }

  async useShuffle() {
    this.busy = true;
    clearTimeout(this.hintTimer);
    await this.renderer.animateShuffle(this.board.shuffle());
    this.onBooster('shuffle');
    this.busy = false;
    this.armHint();
  }

  async useSmash(at) {
    const probe = this.board.get(...at);
    const coconut = this.board.block[at[0]][at[1]] > 0;
    if (!coconut && (!probe || probe.special === 'ingredient')) return;
    this.busy = true;
    this.disarm();
    clearTimeout(this.hintTimer);
    this.started = true;
    await this.run(playSmash(this.board, this.state, at));
    this.onBooster('smash');
    await this.afterTurn();
  }

  // Sweep clears the row and column of the cell; Picker takes every fruit
  // of the kind in it.
  async useAimed(name, at) {
    if (name === 'smash') return this.useSmash(at);
    if (name === 'pick' && !this.board.matchColor(...at)) return;
    this.busy = true;
    this.disarm();
    clearTimeout(this.hintTimer);
    this.started = true;
    if (name === 'pick') this.comboShout = true;
    await this.run((name === 'sweep' ? playSweep : playPick)(this.board, this.state, at));
    this.onBooster(name);
    await this.afterTurn();
  }

  async useSwitch(a, b) {
    if (!this.board.canSwitch(a, b)) return;
    this.busy = true;
    this.disarm();
    this.select(null);
    clearTimeout(this.hintTimer);
    this.started = true;
    if (this.board.isComboSwap(a, b)) this.comboShout = true;
    await this.renderer.animateSwap(a, b);
    await this.run(playSwitch(this.board, this.state, a, b));
    this.onBooster('switch');
    await this.afterTurn();
  }

  // Animate each event before letting the engine compute the next.
  async run(events) {
    const r = this.renderer;
    for (const ev of events) {
      this.emit();
      switch (ev.type) {
        case 'step':
          if (ev.step.bonus) this.countDownMoves(ev.step.converted.length);
          this.shout(ev);
          await r.animateStep(ev.step, ev.points, ev.cascade);
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
        case 'tick':
          await r.animateTick(ev.timers);
          break;
        case 'explode':
          await r.animateExplode(ev.timers);
          break;
        case 'spread':
          await r.animateSpread(ev);
          break;
        case 'defuse':
          r.animateDefuse(ev.ids);
          break;
      }
    }
    this.emit();
  }

  // Big moments get a callout: a special combo, a color bomb made, or a
  // chain reaching 3, 5, 7 or 9 steps.
  shout(ev) {
    if (this.state.inBonus) return;
    if (this.comboShout) {
      this.comboShout = false;
      this.onCallout('Tropical!');
    } else if (ev.step.created.some((m) => m.special === 'bomb')) {
      this.onCallout('Smoothie!');
    } else if (CHAIN_WORDS[ev.cascade]) {
      this.onCallout(CHAIN_WORDS[ev.cascade]);
    }
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
    this.disarm();
    const s = this.state;
    const movesLeft = s.moves;
    const celebrate = !s.exploded && (s.isComplete() || (s.goal.type === 'score' && s.score >= s.level.stars[0]));
    if (celebrate) {
      this.onBanner('Janky Crush!');
      await sleep(600);
    }
    // Score levels fire whatever specials are left either way.
    if (celebrate || (s.goal.type === 'score' && !s.exploded)) await this.run(bonusRound(this.board, s));
    this.onEnd({
      won: s.won(),
      exploded: Boolean(s.exploded),
      stars: s.stars(),
      score: s.score,
      goal: s.goal.type,
      jellyLeft: s.jellyLeft(),
      ingredientsLeft: s.ingredientsLeft(),
      blockersLeft: s.blockersLeft(),
      collectLeft: s.collectLeft(),
      collected: s.collected,
      target: s.level.stars[0],
      stats: s.stats,
      movesLeft,
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
    this.disarm();
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
      // Coconuts can't be picked up, only smashed or swept.
      if (!this.board.get(...cell) && this.armed !== 'smash' && this.armed !== 'sweep') return;
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
      if (TAP_AIMED.includes(this.armed) || !this.board.playable(...target)) return;
      if (this.armed === 'switch') this.useSwitch(start.cell, target);
      else this.attemptSwap(start.cell, target);
    });

    const end = () => {
      if (!start) return;
      if (!start.swiped) {
        const cell = start.cell;
        const sel = this.selected;
        if (TAP_AIMED.includes(this.armed)) this.useAimed(this.armed, cell);
        else if (sel && sel[0] === cell[0] && sel[1] === cell[1]) this.select(null);
        else if (sel && Board.adjacent(sel, cell)) {
          if (this.armed === 'switch') this.useSwitch(sel, cell);
          else this.attemptSwap(sel, cell);
        } else this.select(cell);
      }
      start = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', () => (start = null));
  }
}
