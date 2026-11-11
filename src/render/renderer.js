// Draws the board on a canvas and animates the steps the game loop hands it.
// Visual state (where each candy is drawn) is kept separately from the
// board, so animations can move candies between logical positions.

import { buildSprites, spriteKey, PALETTE, SPRITE } from './sprites.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sameCell = (a, b) => a[0] === b[0] && a[1] === b[1];

// A zigzag from a to b: `n` segments, each kink pushed sideways by up to
// `amp` px. New every frame, which is what makes lightning flicker.
function jaggedPath(a, b, n, amp) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const pts = [{ x: a.x, y: a.y }];
  for (let i = 1; i < n; i++) {
    const f = i / n;
    const off = (Math.random() - 0.5) * 2 * amp;
    pts.push({ x: a.x + dx * f + nx * off, y: a.y + dy * f + ny * off });
  }
  pts.push({ x: b.x, y: b.y });
  return pts;
}

function strokePath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

const PAD = 7;
const GAP = 2;
const BASE_CELL = 42; // the cell size the sprites were drawn for

// Wrapped explosion timing: the candy swells, then the blast rolls outward
// and candies pop as the shockwave reaches them.
const WINDUP_MS = 90;
const EXPLOSION_MS = 420;
const WAVE_MS_PER_CELL = 34;

// Snappy, but each still reads: the player learns what happened from these.
const SWAP_MS = 110;            // two pieces trading places
const CLEAR_MS = 200;           // flash, swell, shrink away
const BEAM_MS = 380;            // stripe beam life
const BEAM_MS_PER_CELL = 18;    // how fast a beam sweeps outward
const MORPH_MS = 200;           // a candy turning into a special
const BOLT_GAP_MAX = 50;        // between bomb bolts...
const BOLT_TOTAL_MAX = 750;     // ...but all of them land within this
const PRIMED_HOLD_MS = 200;     // converted specials sit on screen before firing
const CHAIN_GAP_MAX = 100;      // between blasts in a chain...
const CHAIN_TOTAL_MAX = 1100;   // ...capped for very long chains
export const BONUS_GAP_MAX = 70;       // bonus round: leftover moves turning into stripes...
export const BONUS_TOTAL_MAX = 900;    // ...all within this
const COLLECT_MS = 300;         // an ingredient dropping out of the exit

const ease = {
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  inQuad: (t) => t * t,
  out: (t) => 1 - (1 - t) ** 3,
};

// A small settle at the end of a fall, like the candy lands and squashes.
// Jelly: every candy has a squash spring. `j` > 0 is squashed (wide and
// short), < 0 is stretched (tall and thin). An impulse sets the squash and
// the spring wobbles it back to round, a few times, like a gummy.
const JELLY_K = 520;    // stiffness: about 3.6 wobbles a second
const JELLY_C = 16;     // damping: settles in a couple of wobbles
const JELLY_MAX = 0.3;
const SELECT_BOUNCE_MS = 650;

// Falling: real gravity in board cells per second squared, so a one-cell
// drop takes ~55ms and a long drop speeds up and hits hard.
const GRAVITY = 180;
const START_SPEED = 16;     // cells/s: a nudge so one-cell drops aren't sluggish
const BOUNCE = 0.14;        // how much of the landing speed bounces back
const MAX_HOP_SPEED = 5;    // cells/s, so even big drops only hop a little
const STACK_DELAY_MS = 12;  // candies in a column fall a hair apart
// One color for each portal on a board, so its two ends match.
const PORTAL_COLORS = ['#7cf3ff', '#c79bff', '#ffd45e', '#7dffb0', '#ff9ad0'];

export class Renderer {
  constructor(canvas, board) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.board = board;
    this.visuals = new Map();
    this.tweens = [];
    this.particles = [];
    this.effects = [];
    this.jiggling = new Set();
    // Sound and haptic cues, timed with the animations: cue(name, opts).
    // The game plugs in the audio; by default it's silent.
    this.cue = () => {};
    // Jelly layers still showing while their candy hasn't popped yet.
    this.jellyShown = new Map();
    // Coconut layers still showing until the hit that cracks them lands.
    this.blockShown = new Map();
    this.lockShown = new Set(); // locks still drawn while their opening waits its turn
    this.blockTypeShown = new Map(); // what a cracked-away blocker was, until it's shown cracking
    this.selected = null;
    this.hint = null;
    this.aiming = null; // a booster waiting for a target: the board glows
    this.running = false;
    this.resize();
    this.sync();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    // Boards with holes or notches get their glass cut to the shape.
    const b = this.board;
    this.shaped = b.mask.some((row) => row.some((m) => !m));
    this.canvas.classList.toggle('shaped', this.shaped);
    const w = this.canvas.clientWidth;
    const cols = this.board.cols, rows = this.board.rows;
    this.pitch = (w - PAD * 2 + GAP) / cols;
    this.cell = this.pitch - GAP;
    const h = PAD * 2 + rows * this.pitch - GAP;
    this.canvas.style.height = `${h}px`;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.width = w;
    this.height = h;
    this.dpr = dpr;
    this.buildShape();
    this.placeSpouts();
    if (this.spriteDpr !== dpr) {
      // Sprites are drawn a bit larger than 1:1 when the cell is bigger than
      // the design size, so scale the backing resolution with it.
      // Sprites rasterize asynchronously; until they're in, only the tiles draw.
      const scale = dpr * Math.max(1, this.cell / BASE_CELL);
      this.ready = buildSprites(scale).then((sprites) => {
        this.sprites = sprites;
        this.requestDraw();
      });
      this.spriteDpr = dpr;
    }
    this.requestDraw();
  }

  // For a shaped board: a mask that cuts the glass to the cells (each cell
  // grown a little so they merge into one smooth shape), and a white rim
  // drawn around it.
  buildShape() {
    const { canvas, board, dpr } = this;
    if (!this.shaped) {
      this.outline = null;
      canvas.style.webkitMaskImage = canvas.style.maskImage = '';
      return;
    }
    const blob = (grow, radius) => {
      const off = document.createElement('canvas');
      off.width = canvas.width;
      off.height = canvas.height;
      const c = off.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.fillStyle = '#fff';
      c.beginPath();
      for (let r = 0; r < board.rows; r++)
        for (let col = 0; col < board.cols; col++)
          if (board.mask[r][col]) c.roundRect(PAD + col * this.pitch - grow, PAD + r * this.pitch - grow, this.cell + grow * 2, this.cell + grow * 2, radius);
      c.fill();
      // Where four cells meet, their round corners leave a small hole: fill it.
      const on = (r, col) => board.mask[r]?.[col];
      for (let r = 0; r < board.rows - 1; r++)
        for (let col = 0; col < board.cols - 1; col++)
          if (on(r, col) && on(r + 1, col) && on(r, col + 1) && on(r + 1, col + 1))
            c.fillRect(PAD + (col + 1) * this.pitch - GAP / 2 - radius, PAD + (r + 1) * this.pitch - GAP / 2 - radius, radius * 2, radius * 2);
      return off;
    };
    const outer = blob(6, 14);
    const url = `url(${outer.toDataURL()})`;
    canvas.style.webkitMaskImage = canvas.style.maskImage = url;
    canvas.style.webkitMaskSize = canvas.style.maskSize = '100% 100%';
    // The rim: the outer shape minus a slightly smaller one.
    const ring = blob(6, 14);
    const rc = ring.getContext('2d');
    rc.setTransform(1, 0, 0, 1, 0, 0); // the blobs are already in device pixels
    rc.globalCompositeOperation = 'destination-out';
    rc.drawImage(blob(2.5, 11), 0, 0);
    this.outline = ring;
  }

  // Dispenser spouts sit above their column, just over the board's edge.
  // They're page elements next to the canvas, so they can poke out of it.
  placeSpouts() {
    const wrap = this.canvas.closest('.board-wrap');
    if (!wrap) return;
    wrap.querySelectorAll('.spout').forEach((n) => n.remove());
    this.spouts = new Map();
    const box = this.canvas.getBoundingClientRect(), outer = wrap.getBoundingClientRect();
    const border = (box.width - this.width) / 2;
    for (const d of this.board.dispensers ?? []) {
      const top = this.board.topRow(d.col);
      if (top < 0) continue;
      const el = document.createElement('div');
      el.className = `spout ${d.kind}`;
      el.setAttribute('aria-hidden', 'true');
      el.style.left = `${box.left - outer.left + border + PAD + d.col * this.pitch + this.cell / 2}px`;
      el.style.top = `${box.top - outer.top + border + PAD + top * this.pitch}px`;
      wrap.append(el);
      this.spouts.set(d.col, el);
    }
  }

  // Snap every candy's visual to its board position.
  sync() {
    this.visuals.clear();
    const b = this.board;
    for (let r = 0; r < b.rows; r++)
      for (let c = 0; c < b.cols; c++) {
        const cell = b.grid[r][c];
        if (cell) this.visuals.set(cell.id, { candy: cell, row: r, col: c, scale: 1, alpha: 1 });
      }
    this.requestDraw();
  }

  center(row, col) {
    return {
      x: PAD + col * this.pitch + this.cell / 2,
      y: PAD + row * this.pitch + this.cell / 2,
    };
  }

  cellAt(x, y) {
    const c = Math.floor((x - PAD + GAP / 2) / this.pitch);
    const r = Math.floor((y - PAD + GAP / 2) / this.pitch);
    return this.board.playable(r, c) ? [r, c] : null;
  }

  // ---- animation plumbing -------------------------------------------------

  tween(duration, update, easing = ease.inOut) {
    return new Promise((resolve) => {
      this.tweens.push({ start: performance.now(), duration, update, easing, resolve });
      this.requestDraw();
    });
  }

  requestDraw() {
    if (this.running) return;
    this.running = true;
    requestAnimationFrame((t) => this.frame(t));
  }

  frame(now) {
    for (const tw of [...this.tweens]) {
      const t = Math.min(1, (now - tw.start) / tw.duration);
      tw.update(tw.easing(t), t);
      if (t >= 1) {
        this.tweens.splice(this.tweens.indexOf(tw), 1);
        tw.resolve();
      }
    }
    this.stepParticles(now);
    this.stepJelly(now);
    this.effects = this.effects.filter((e) => now - e.born < e.life);
    this.applyShake(now);
    this.draw(now);
    const shaking = this.shake && now - this.shake.born < this.shake.life;
    // Specials pulse, so keep drawing while any are on the board.
    const lit = [...this.visuals.values()].some((v) => v.candy.special && v.candy.special !== 'ingredient');
    const busy = this.jiggling.size || shaking || this.tweens.length || this.particles.length || this.effects.length || lit || this.selected || this.hint || this.aiming;
    if (busy) requestAnimationFrame((t) => this.frame(t));
    else this.running = false;
  }

  // ---- steps --------------------------------------------------------------

  // Both take board positions before the board itself is swapped.
  // Candies stretch the way they're moving, then wobble when they stop.
  swapMover(a, b) {
    const va = this.visualAt(a), vb = this.visualAt(b);
    const sideways = a[0] === b[0];
    const move = (k) => {
      const stretch = 0.12 * Math.sin(k * Math.PI) * (sideways ? 1 : -1); // wide when sliding sideways
      if (va) { va.row = a[0] + (b[0] - a[0]) * k; va.col = a[1] + (b[1] - a[1]) * k; va.stretch = stretch; }
      if (vb) { vb.row = b[0] + (a[0] - b[0]) * k; vb.col = b[1] + (a[1] - b[1]) * k; vb.stretch = stretch; }
    };
    move.settle = () => {
      for (const v of [va, vb]) {
        if (!v) continue;
        v.stretch = 0;
        // Stopping sideways squeezes it tall; stopping up/down squashes it flat.
        this.jiggle(v, sideways ? -0.1 : 0.1);
      }
    };
    return move;
  }

  async animateSwap(a, b) {
    this.cue('swap');
    const move = this.swapMover(a, b);
    await this.tween(SWAP_MS, move);
    move.settle();
  }

  // Swap there and back, for a swap that doesn't match.
  async animateBadSwap(a, b) {
    this.cue('boing');
    const move = this.swapMover(a, b);
    await this.tween(SWAP_MS, move);
    move.settle();
    await sleep(40);
    await this.tween(SWAP_MS, (k) => move(1 - k));
    move.settle();
  }

  // A locked fruit that the player tried to move: it wobbles in its cage.
  rattle(at) {
    this.cue('boing');
    const v = this.visualAt(at);
    if (v) this.jiggle(v, 0.14);
    this.shake = { born: performance.now(), life: 160, amp: 2 };
    this.requestDraw();
  }

  // Animate one resolution step from Board.resolveStep / comboStep /
  // firePrimed. Blasts go off one after another so chain reactions ripple,
  // and each candy pops when the blast that hit it arrives.
  async animateStep(step, points, chain = 1) {
    const t0 = performance.now();
    const later = (ms, name, opts) => setTimeout(() => this.cue(name, opts), Math.max(0, ms));
    const n = step.blasts.length;
    const gap = n > 1 ? Math.min(CHAIN_GAP_MAX, CHAIN_TOTAL_MAX / n) : 0;
    const boltGap = (b) => Math.min(BOLT_GAP_MAX, BOLT_TOTAL_MAX / Math.max(1, b.targets.length));
    const boltLands = (i, j) => blastAt[i] + j * boltGap(step.blasts[i]) + 120;
    // Each blast waits for the one before it to land.
    const blastAt = [];
    step.blasts.forEach((b, i) => {
      const prev = step.blasts[i - 1];
      if (i === 0) blastAt.push(0);
      else if (prev.kind === 'area') blastAt.push(blastAt[i - 1] + WINDUP_MS + 220);
      else if (prev.kind === 'bolts') blastAt.push(boltLands(i - 1, prev.targets.length));
      else blastAt.push(blastAt[i - 1] + gap);
    });
    const jobs = [];
    // Stereo position of a cell for the sound: -1 left edge, 1 right edge.
    const panAt = (at) => (this.board.cols > 1 ? (at[1] / (this.board.cols - 1)) * 2 - 1 : 0);

    // One chime per step for the matches, climbing with the cascade.
    if (step.groups.length) {
      const size = Math.max(...step.groups.map((g) => g.cells.length));
      this.cue('match', { chain, size, x: panAt(step.groups[0].cells[1] ?? step.groups[0].cells[0]) });
    }

    step.blasts.forEach((b, i) => {
      if (b.kind === 'bolts') {
        const span = b.targets.length * boltGap(b) + 600;
        this.effects.unshift({ kind: 'dim', born: t0 + blastAt[i], life: span });
        b.targets.forEach((to, j) => {
          this.effects.push({ kind: 'bolt', from: b.at, to, born: t0 + blastAt[i] + j * boltGap(b), life: 480 });
          later(blastAt[i] + j * boltGap(b), 'bolt', { x: panAt(to) });
        });
      } else if (b.kind === 'area') {
        this.effects.push({ ...b, born: t0 + blastAt[i] + WINDUP_MS, life: EXPLOSION_MS });
        jobs.push(this.detonate(b, blastAt[i]));
      } else if (b.kind === 'smash') {
        // The mallet: a flash and a little shake where it lands.
        this.effects.push({ kind: 'spark', at: b.at, born: t0 + blastAt[i], life: 420 });
        this.shake = { born: t0 + blastAt[i], life: 220, amp: 3 };
        later(blastAt[i], 'smash', { x: panAt(b.at) });
      } else {
        this.effects.push({ ...b, born: t0 + blastAt[i], life: b.kind === 'board' ? 500 : BEAM_MS });
        later(blastAt[i], b.kind === 'board' ? 'boom' : 'zap', { dir: b.kind, x: b.at ? panAt(b.at) : 0 });
      }
    });
    this.requestDraw();

    if (points) {
      const anchor = step.created[0]?.at ?? step.groups[0]?.cells[1] ?? step.cleared[0]?.at;
      if (anchor) {
        const { x, y } = this.center(...anchor);
        this.particles.push({ text: `+${points}`, x, y, vx: 0, vy: -0.03, life: 1200, born: t0, color: '#ffffff' });
      }
    }

    // Candies turning into specials: as each bomb bolt lands, or one after
    // another in the end-of-level bonus.
    if (step.converted.length) {
      const i = step.blasts.findIndex((b) => b.kind === 'bolts');
      const b = step.blasts[i];
      const bonusGap = Math.min(BONUS_GAP_MAX, BONUS_TOTAL_MAX / step.converted.length);
      let last = 0;
      step.converted.forEach((c, n) => {
        const v = this.visuals.get(c.candy.id);
        if (!v) return;
        v.override = c.candy.color;
        const at = b
          ? boltLands(i, Math.max(0, b.targets.findIndex((p) => sameCell(p, c.at))))
          : n * bonusGap;
        last = Math.max(last, at);
        if (!b) this.effects.push({ kind: 'spark', at: c.at, born: t0 + at, life: 420 });
        jobs.push(sleep(at).then(() => {
          this.cue('morph', { i: n, x: panAt(c.at) });
          return this.morph(v);
        }));
      });
      // Let every new special sit on screen before they go off.
      jobs.push(sleep(last + MORPH_MS + PRIMED_HOLD_MS));
    } else if (step.bonus) {
      // Bonus with no leftover moves: a beat before the specials fire.
      jobs.push(sleep(PRIMED_HOLD_MS));
    }

    // When each cleared candy goes.
    const delayFor = (x) => {
      if (x.special === 'bomb') {
        const i = step.blasts.findIndex((b) => b.kind === 'bolts' && sameCell(b.at, x.at));
        if (i >= 0) return boltLands(i, step.blasts[i].targets.length);
      }
      if (step.blasts[0]?.kind === 'board') return 150 + (x.at[0] + x.at[1]) * 35;
      if (x.cause < 0) return 0;
      const b = step.blasts[x.cause];
      switch (b.kind) {
        case 'area': {
          const dist = Math.max(Math.abs(x.at[0] - b.at[0]), Math.abs(x.at[1] - b.at[1]));
          return blastAt[x.cause] + WINDUP_MS + 40 + dist * WAVE_MS_PER_CELL;
        }
        case 'row':
          return blastAt[x.cause] + Math.abs(x.at[1] - b.at[1]) * BEAM_MS_PER_CELL;
        case 'col':
          return blastAt[x.cause] + Math.abs(x.at[0] - b.at[0]) * BEAM_MS_PER_CELL;
        case 'bolts':
          return boltLands(x.cause, Math.max(0, b.targets.findIndex((p) => sameCell(p, x.at))));
        default:
          return blastAt[x.cause];
      }
    };

    const many = step.cleared.length > 20;
    for (const x of step.cleared) {
      const v = this.visuals.get(x.id);
      jobs.push(sleep(delayFor(x)).then(() => {
        const { x: px, y: py } = this.center(...x.at);
        if (x.special === 'gummy') {
          this.crack({ at: x.at, left: 0, type: 'gummy' });
        } else {
          this.confetti(px, py, x.color, many ? 6 : 12);
          if (x.color) this.cue('cleared', { color: x.color, x: px, y: py });
        }
        this.cue('pop', { x: panAt(x.at) });
        if (!v) return;
        // Squish, flash white and swell, then shrink away.
        this.jiggle(v, 0.14);
        return this.tween(CLEAR_MS, (k) => {
          if (k < 0.3) {
            const u = k / 0.3;
            v.scale = 1 + 0.25 * u;
            v.flash = u;
          } else {
            const u = (k - 0.3) / 0.7;
            v.scale = 1.25 * (1 - u);
            v.alpha = 1 - u * u;
            v.flash = 1 - u;
          }
        }, (t) => t).then(() => this.visuals.delete(x.id));
      }));
    }

    // Jelly under a cell comes off when its candy pops.
    for (const h of step.jellyHit) {
      const k = h.at[0] * 100 + h.at[1];
      this.jellyShown.set(k, h.left + 1);
      const x = step.cleared.find((c) => sameCell(c.at, h.at));
      jobs.push(sleep(x ? delayFor(x) : 0).then(() => {
        this.jellyShown.delete(k);
        this.effects.push({ kind: 'jelly', at: h.at, left: h.left, born: performance.now(), life: 480 });
        this.cue('foam', { x: panAt(h.at) });
        this.requestDraw();
      }));
    }

    // Coconuts crack when the match beside them pops or a blast reaches them.
    for (const h of step.blocksHit ?? []) {
      const k = h.at[0] * 100 + h.at[1];
      this.blockShown.set(k, h.left + 1);
      this.blockTypeShown.set(k, h.type);
      jobs.push(sleep(delayFor({ at: h.at, cause: h.cause })).then(() => {
        this.blockShown.delete(k);
        this.blockTypeShown.delete(k);
        this.crack(h);
      }));
    }

    // A lock opens when the match or blast that hit it goes off.
    for (const u of step.unlocked ?? []) {
      const k = u.at[0] * 100 + u.at[1];
      this.lockShown.add(k);
      jobs.push(sleep(delayFor({ at: u.at, cause: u.cause })).then(() => {
        this.lockShown.delete(k);
        this.crack({ at: u.at, left: 0, type: 'lock' });
        const v = this.visualAt(u.at);
        if (v) this.jiggle(v, 0.16);
      }));
    }

    // New specials pop in where they formed.
    for (const m of step.created) {
      const v = this.visuals.get(m.candy.id);
      if (v) jobs.push(this.pop(v));
      this.cue('sparkle', { kind: m.special === 'bomb' ? 'bomb' : m.special === 'wrapped' ? 'wrapped' : 'stripe', x: panAt(m.at) });
    }

    await Promise.all(jobs);
    // Let the last bolts and beams finish before things fall.
    const tail = Math.max(0, ...this.effects.map((e) => e.born + e.life * 0.6)) - performance.now();
    if (tail > 0) await sleep(tail);
  }

  // A coconut taking a hit: shell chips fly; the last hit splits it with a
  // splash of coconut milk.
  crack(h) {
    const { x, y } = this.center(...h.at);
    const now = performance.now();
    const chips = h.left === 0 ? 16 : 9;
    const palette = h.type === 'lock' ? ['#d6f07a', '#9ccf3a', '#5f9618', '#e9c98a'] : h.type === 'gummy' ? ['#b8ff7a', '#48d62a', '#1f8f12', '#ffffff'] : h.type === 'mochi' ? ['#ffffff', '#ffd1e6', '#ff7fb8', '#f3e6df'] : ['#6b3a16', '#8a5226', '#3b1f0b', '#c98a52'];
    for (let i = 0; i < chips; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.1 + Math.random() * 0.16;
      this.particles.push({
        kind: 'confetti', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.12, g: 0.0009,
        life: 600 + Math.random() * 300, born: now, color: palette[i % 4],
        size: 4 + Math.random() * 4, spin: (Math.random() - 0.5) * 0.04, angle: Math.random() * 6,
      });
    }
    if (h.left === 0) {
      for (let i = 0; i < 10; i++) this.burst(x, y, '#fffaf0', 1, 0.08 + Math.random() * 0.14);
      this.effects.push({ kind: 'ring', x, y, color: '#fff4dc', born: now, life: 360 });
    }
    this.shake = { born: now, life: 140, amp: h.left === 0 ? 3 : 2 };
    this.cue(h.type === 'mochi' || h.type === 'gummy' ? 'squish' : 'crack', { x: this.board.cols > 1 ? (h.at[1] / (this.board.cols - 1)) * 2 - 1 : 0, last: h.left === 0 });
    this.requestDraw();
  }

  // Ingredients drop out through the exit with a golden burst.
  async animateCollect(items, points) {
    const jobs = items.map((it) => {
      const v = this.visuals.get(it.id);
      const { x, y } = this.center(...it.at);
      for (let i = 0; i < 14; i++) this.burst(x, y, i % 2 ? '#ffe14d' : '#ffffff', 1, 0.08 + Math.random() * 0.12);
      this.cue('splash');
      if (it.candy.kind === 'duck') setTimeout(() => this.cue('quack'), 120);
      this.particles.push({ text: `+${points / items.length}`, x, y: y - 6, vx: 0, vy: -0.03, life: 1100, born: performance.now(), color: '#fff6b0', stroke: '#b06a00' });
      if (!v) return null;
      this.jiggle(v, -0.2);
      return this.tween(COLLECT_MS, (k) => {
        v.row = it.at[0] + 1.1 * k * k;
        v.alpha = 1 - k * k;
        v.scale = 1 + 0.25 * Math.sin(k * Math.PI);
      }, (t) => t).then(() => this.visuals.delete(it.id));
    });
    await Promise.all(jobs);
  }

  // Shrink with a flash, swap to the special's look, then pop back up.
  morph(v) {
    return this.tween(MORPH_MS, (k) => {
      if (k < 0.4) {
        const u = k / 0.4;
        v.scale = 1 - 0.45 * u;
        v.flash = u;
      } else {
        v.override = null;
        const u = (k - 0.4) / 0.6;
        v.scale = 0.55 + 0.45 * u + 0.35 * Math.sin(u * Math.PI);
        v.flash = 1 - u;
      }
    }, (t) => t).then(() => {
      v.scale = 1;
      v.flash = 0;
    });
  }

  // The wrapped candy swells and brightens, then blows: shake and sparks.
  async detonate(blast, delay) {
    await sleep(delay);
    const cand = this.board.get(...blast.at);
    const v = cand && this.visuals.get(cand.id);
    const x = this.board.cols > 1 ? (blast.at[1] / (this.board.cols - 1)) * 2 - 1 : 0;
    this.cue('windup', { x });
    if (v) await this.tween(WINDUP_MS, (k) => (v.scale = 1 + 0.4 * k), ease.inQuad);
    this.cue('boom', { x });
    if (v && v.candy.special === 'wrappedLit') v.scale = 1;
    const { x: px, y } = this.center(...blast.at);
    const colors = ['#ffffff', '#ff3d8b', '#ff8a1f', '#ffe14d'];
    for (let i = 0; i < 44; i++) this.burst(px, y, colors[i % colors.length], 1, 0.12 + Math.random() * 0.24);
    this.confetti(px, y, null, 16);
    this.shake = { born: performance.now(), life: 380, amp: 5 + blast.radius * 3 };
    this.requestDraw();
  }

  pop(v) {
    this.jiggle(v, -0.16);
    return this.tween(240, (k) => (v.scale = 1 + 0.5 * Math.sin(k * Math.PI)), (t) => t);
  }

  jiggle(v, amount) {
    v.j = Math.max(-JELLY_MAX, Math.min(JELLY_MAX, (v.j ?? 0) + amount));
    v.jv = v.jv ?? 0;
    this.jiggling.add(v);
    this.requestDraw();
  }

  stepJelly(now) {
    const dt = this.lastJelly ? Math.min(0.033, (now - this.lastJelly) / 1000) : 0.016;
    this.lastJelly = now;
    // The selected candy keeps bouncing, like it's waiting to be moved.
    if (this.selected) {
      const v = this.visualAt(this.selected);
      if (v && (!this.lastBounce || now - this.lastBounce > SELECT_BOUNCE_MS)) {
        this.lastBounce = now;
        this.jiggle(v, 0.12);
      }
    }
    for (const v of this.jiggling) {
      // Two half-steps keep the stiff spring stable at 60Hz.
      for (let i = 0; i < 2; i++) {
        const h = dt / 2;
        v.jv += (-JELLY_K * v.j - JELLY_C * v.jv) * h;
        v.j += v.jv * h;
      }
      if (Math.abs(v.j) < 0.002 && Math.abs(v.jv) < 0.03) {
        v.j = 0;
        v.jv = 0;
        this.jiggling.delete(v);
      }
    }
  }

  animateFall(moves, spawns) {
    for (const s of spawns) {
      if (!s.dispensed) continue;
      const el = this.spouts?.get(s.col ?? s.to[1]);
      el?.animate([{ transform: 'translate(-50%, -100%) scale(1)' }, { transform: 'translate(-50%, -100%) scale(1.3, .8)' }, { transform: 'translate(-50%, -100%) scale(1)' }], { duration: 260 });
      this.cue('sparkle', { kind: s.candy.special === 'bomb' ? 'bomb' : s.candy.special === 'gummy' ? 'wrapped' : 'stripe' });
    }
    // A piece bound for a cell past a portal drops into the column `col`.
    for (const s of spawns)
      this.visuals.set(s.id, { candy: s.candy, row: s.fromRow, col: s.col ?? s.to[1], scale: 1, alpha: 1 });
    const jobs = [
      ...moves.map((m) => ({ v: this.visuals.get(m.id), from: m.from[0], to: m.to[0], fromCol: m.from[1], toCol: m.to[1], via: m.via })),
      ...spawns.map((s) => ({ v: this.visuals.get(s.id), from: s.fromRow, to: s.to[0], fromCol: s.col ?? s.to[1], toCol: s.to[1], via: s.via })),
    ].filter((j) => j.v);
    const landed = new Map(); // "row,col" -> visual, for the jiggle below
    for (const v of this.visuals.values()) if (Number.isInteger(v.row)) landed.set(`${v.row},${v.col}`, v);
    for (const j of jobs) landed.delete(`${j.v.row},${j.v.col}`);

    // Bottom of each column first, so candies pile in rather than moving
    // as one block.
    const stack = new Map();
    jobs.sort((p, q) => q.to - p.to);
    for (const j of jobs) {
      const n = stack.get(j.toCol) ?? 0;
      stack.set(j.toCol, n + 1);
      j.delay = n * STACK_DELAY_MS;
    }
    return Promise.all(jobs.map((j) => sleep(j.delay).then(() => (j.via ? this.dropThrough(j, landed) : this.drop(j, landed)))));
  }

  // A piece that goes through one or more portals: it sinks into each
  // entrance and fades out, then comes out of the exit and falls on.
  async dropThrough(j, landed) {
    const v = j.v;
    let from = j.from, col = j.fromCol;
    for (const portal of j.via) {
      const end = portal.from[0] + 1; // one cell below the entrance
      const dist = Math.max(0.5, end - from);
      const time = ((-START_SPEED + Math.sqrt(START_SPEED * START_SPEED + 2 * GRAVITY * dist)) / GRAVITY) * 1000;
      const start = from;
      await this.tween(time, (_, t) => {
        const sec = (t * time) / 1000;
        v.row = Math.min(end, start + START_SPEED * sec + 0.5 * GRAVITY * sec * sec);
        v.col = col;
        const sunk = Math.max(0, v.row - portal.from[0]);
        v.alpha = 1 - sunk;
        v.scale = 1 - sunk * 0.5;
      }, (t) => t);
      this.portalFlash(portal);
      from = portal.to[0] - 1;
      col = portal.to[1];
      v.row = from;
      v.col = col;
      v.alpha = 0;
    }
    await this.drop({ v, from, to: j.to, fromCol: col, toCol: j.toCol, emerge: true }, landed);
    v.alpha = 1;
    v.scale = 1;
  }

  portalFlash(portal) {
    const now = performance.now();
    for (const [r, c, dy] of [[...portal.from, 0.5], [...portal.to, -0.5]]) {
      const { x, y } = this.center(r + dy, c);
      this.effects.push({ kind: 'ring', x, y, color: this.portalColor(portal), born: now, life: 300 });
    }
    this.requestDraw();
  }

  portalColor(portal) {
    return PORTAL_COLORS[(portal.color ?? this.board.portals.indexOf(portal)) % PORTAL_COLORS.length];
  }

  // The two ends of each portal: a glowing oval under the entrance cell
  // and one above the exit cell, in the portal's own color.
  drawPortals(now) {
    const { ctx, board } = this;
    if (!board.portals.length) return;
    const pulse = 0.5 + 0.5 * Math.sin(now / 300);
    ctx.save();
    for (const portal of board.portals) {
      const color = this.portalColor(portal);
      for (const [r, c, dy] of [[...portal.from, 0.5], [...portal.to, -0.5]]) {
        const { x } = this.center(r, c);
        const y = Math.max(this.cell * 0.11 + 3, Math.min(this.height - this.cell * 0.11 - 3, PAD + r * this.pitch + this.cell / 2 + dy * this.pitch));
        ctx.beginPath();
        ctx.ellipse(x, y, this.cell * 0.4, this.cell * 0.11, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(20, 8, 50, .85)';
        ctx.shadowColor = color;
        ctx.shadowBlur = 8 + 6 * pulse;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.ellipse(x, y, this.cell * 0.24, this.cell * 0.05, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.4 * pulse})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // One candy falls under gravity, hits, hops a little and settles.
  drop(j, landed) {
    const v = j.v;
    const dist = j.to - j.from;
    // Solve dist = v0·t + ½·g·t² for the time to land.
    const v0 = START_SPEED;
    const tFall = (-v0 + Math.sqrt(v0 * v0 + 2 * GRAVITY * dist)) / GRAVITY;
    const impact = v0 + GRAVITY * tFall;
    const hop = Math.min(MAX_HOP_SPEED, impact * BOUNCE);
    const tHop = (2 * hop) / GRAVITY;
    const total = (tFall + tHop) * 1000;
    let hit = false;
    const land = () => {
      if (hit) return;
      hit = true;
      v.stretch = 0;
      // Squash sized to how hard it hit.
      this.jiggle(v, Math.min(0.26, 0.05 + 0.006 * impact));
      this.cue('land', { hard: Math.min(1, impact / 30) });
      v.col = j.toCol;
      const below = landed.get(`${j.to + 1},${v.col}`);
      if (below) this.jiggle(below, Math.min(0.1, 0.002 * impact + 0.02));
      landed.set(`${j.to},${v.col}`, v);
    };
    return this.tween(total, (_, t) => {
      const sec = (t * total) / 1000;
      if (sec < tFall) {
        v.row = j.from + v0 * sec + 0.5 * GRAVITY * sec * sec;
        if (j.emerge) {
          const out = Math.max(0, Math.min(1, (v.row - j.from) / 0.8)); // comes out of the portal
          v.alpha = out;
          v.scale = 0.5 + 0.5 * out;
        }
        // Sliding around a coconut: drift sideways over the last cell.
        if (j.toCol !== j.fromCol) v.col = j.fromCol + (j.toCol - j.fromCol) * Math.max(0, Math.min(1, v.row - (j.to - 1)));
        v.stretch = -Math.min(0.12, 0.004 * (v0 + GRAVITY * sec)); // drawn out by speed
      } else {
        land();
        const u = sec - tFall;
        v.row = j.to - (hop * u - 0.5 * GRAVITY * u * u);
      }
    }, (t) => t).then(() => {
      land();
      v.row = j.to;
      v.col = j.toCol;
      v.stretch = 0;
    });
  }

  animateShuffle(moves) {
    this.cue('shuffle');
    if (!moves) {
      this.sync();
      return Promise.resolve();
    }
    const jobs = moves.map((m) => ({ v: this.visuals.get(m.id), m })).filter((j) => j.v);
    return this.tween(280, (k) => {
      for (const { v, m } of jobs) {
        v.row = m.from[0] + (m.to[0] - m.from[0]) * k;
        v.col = m.from[1] + (m.to[1] - m.from[1]) * k;
        v.scale = 1 - Math.sin(k * Math.PI) * 0.35;
      }
    });
  }

  visualAt([r, c]) {
    const cell = this.board.get(r, c);
    return cell ? this.visuals.get(cell.id) : null;
  }

  setSelected(cell) {
    this.selected = cell;
    this.requestDraw();
  }

  setAiming(name) {
    this.aiming = name;
    this.requestDraw();
  }

  setHint(pair) {
    this.hint = pair ? { pair, since: performance.now() } : null;
    this.requestDraw();
  }

  // ---- particles ----------------------------------------------------------

  // A fruit bursting: spinning confetti in its colors with white and gold,
  // a few juice drops, and a ring that pops outward.
  confetti(x, y, color, count = 12) {
    const now = performance.now();
    const shades = color ? [...PALETTE[color], '#ffffff', '#ffe14d'] : ['#ffffff', '#ff5fa2', '#ffe14d', '#2ec4d6', '#9b4dff'];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.12 + Math.random() * 0.16;
      this.particles.push({
        kind: 'confetti', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.1, g: 0.0007,
        life: 550 + Math.random() * 350, born: now, color: shades[i % shades.length],
        size: 3 + Math.random() * 3.5, spin: (Math.random() - 0.5) * 0.03, angle: Math.random() * 6,
      });
    }
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      this.particles.push({ x, y, vx: Math.cos(a) * 0.08, vy: Math.sin(a) * 0.08 - 0.06, g: 0.0006, life: 450, born: now, color: color ? PALETTE[color][0] : '#ffffff', size: 3.5 + Math.random() * 2 });
    }
    this.effects.push({ kind: 'ring', x, y, color: color ? PALETTE[color][0] : '#ffffff', born: now, life: 320 });
  }

  burst(x, y, color, count = 7, speed = null) {
    const now = performance.now();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed ?? 0.06 + Math.random() * 0.08;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 380 + Math.random() * 200, born: now, color, size: 1.5 + Math.random() * 2 });
    }
  }

  stepParticles(now) {
    const dt = this.lastFrame ? Math.min(50, now - this.lastFrame) : 16;
    this.lastFrame = now;
    this.particles = this.particles.filter((p) => now - p.born < p.life);
    for (const p of this.particles) {
      if (p.g) p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.spin) p.angle += p.spin * dt;
    }
  }

  // ---- drawing ------------------------------------------------------------

  // Jelly is bath foam: a puffy white layer with bubbles. Double foam is
  // thicker, with a blue rim.
  drawJelly(x, y, layers) {
    const { ctx } = this;
    const double = layers > 1;
    const c = this.cell;
    ctx.save();
    const grad = ctx.createLinearGradient(0, y, 0, y + c);
    grad.addColorStop(0, double ? 'rgba(150,224,252,.97)' : 'rgba(205,243,255,.95)');
    grad.addColorStop(1, double ? 'rgba(70,182,232,.97)' : 'rgba(140,215,245,.95)');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = double ? 3 : 2;
    ctx.shadowColor = 'rgba(60,170,210,.7)';
    ctx.shadowBlur = double ? 6 : 3;
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, c - 2, c - 2, 9);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Bubbles around the edges, where the fruit doesn't cover them. Same
    // layout every frame for a given cell.
    const flip = ((x * 7 + y * 13) | 0) % 2 ? 1 : -1;
    const bubbles = [[0.17, 0.18, 0.12], [0.84, 0.16, 0.1], [0.86, 0.84, 0.13], [0.15, 0.85, 0.1], [0.5, 0.09, 0.07], [0.09, 0.5, 0.06]];
    for (const [bx0, by, br] of bubbles) {
      const bx = flip > 0 ? bx0 : 1 - bx0;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x + c * bx, y + c * by, c * br, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(110,200,235,.8)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,1)';
      ctx.beginPath();
      ctx.arc(x + c * bx - c * br * 0.3, y + c * by - c * br * 0.3, c * br * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (double) {
      ctx.strokeStyle = 'rgba(70,180,220,.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x - 0.5, y - 0.5, c + 1, c + 1, 10);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Exit: a pulsing gold chevron at the bottom of the tile.
  drawExit(x, y, now) {
    const { ctx } = this;
    const cx = x + this.cell / 2, by = y + this.cell - 4;
    const pulse = 0.55 + 0.45 * Math.sin(now / 260);
    ctx.save();
    ctx.strokeStyle = `rgba(255,225,77,${0.5 + 0.5 * pulse})`;
    ctx.shadowColor = '#ffe14d';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 6, by - 5 + pulse * 1.5);
    ctx.lineTo(cx, by + pulse * 1.5);
    ctx.lineTo(cx + 6, by - 5 + pulse * 1.5);
    ctx.stroke();
    ctx.restore();
  }

  applyShake(now) {
    const sh = this.shake;
    if (!sh) return;
    const t = (now - sh.born) / sh.life;
    if (t >= 1) {
      this.canvas.style.transform = '';
      this.shake = null;
      return;
    }
    const a = sh.amp * (1 - t);
    this.canvas.style.transform = `translate(${(Math.random() - 0.5) * 2 * a}px, ${(Math.random() - 0.5) * 2 * a}px)`;
  }

  // Limit drawing to the board's own cells (it may have holes and notches).
  clipToBoard() {
    const { ctx, board } = this;
    ctx.beginPath();
    for (let r = 0; r < board.rows; r++)
      for (let c = 0; c < board.cols; c++)
        if (board.playable(r, c)) ctx.rect(PAD + c * this.pitch - GAP / 2, PAD + r * this.pitch - GAP / 2, this.pitch, this.pitch);
    ctx.clip();
  }

  // Blast effects: beams for stripes, a shockwave for wrapped, lightning for
  // the color bomb, and a flash when two bombs clear the board.
  drawEffect(e, now) {
    const { ctx } = this;
    const t = (now - e.born) / e.life;
    if (t < 0) return; // scheduled for later in a chain
    const fade = 1 - t;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = '#2de2e6';
    ctx.shadowBlur = 18;
    switch (e.kind) {
      case 'row':
      case 'col': {
        // The beam shoots out both ways from the stripe that fired it.
        const row = e.kind === 'row';
        const o = this.center(...e.at);
        const reach = ((now - e.born) / BEAM_MS_PER_CELL + 0.5) * this.pitch;
        const hot = Math.max(0, 1 - t * 1.4);
        // Three layers: a wide warm glow, the beam, and a white-hot core.
        const layers = [
          { span: this.cell * (1.7 - 0.9 * t), mid: `rgba(255,190,60,${0.55 * fade})`, edge: 'rgba(255,120,40,0)' },
          { span: this.cell * (1.05 - 0.5 * t), mid: `rgba(255,255,255,${fade})`, edge: 'rgba(45,226,230,0)' },
          { span: this.cell * 0.22 * (1 - t * 0.6), mid: `rgba(255,255,255,${hot})`, edge: `rgba(255,255,255,${0.6 * hot})` },
        ];
        const x0 = Math.max(0, o.x - reach), x1 = Math.min(this.width, o.x + reach);
        const y0 = Math.max(0, o.y - reach), y1 = Math.min(this.height, o.y + reach);
        ctx.shadowColor = '#ffcf3a';
        ctx.shadowBlur = 24;
        for (const l of layers) {
          const g = row
            ? ctx.createLinearGradient(0, o.y - l.span / 2, 0, o.y + l.span / 2)
            : ctx.createLinearGradient(o.x - l.span / 2, 0, o.x + l.span / 2, 0);
          g.addColorStop(0, l.edge);
          g.addColorStop(0.5, l.mid);
          g.addColorStop(1, l.edge);
          ctx.fillStyle = g;
          if (row) ctx.fillRect(x0, o.y - l.span / 2, x1 - x0, l.span);
          else ctx.fillRect(o.x - l.span / 2, y0, l.span, y1 - y0);
        }
        // Comet heads racing out to each end, throwing sparks.
        if (t < 0.6) {
          const heads = row ? [{ x: x0, y: o.y }, { x: x1, y: o.y }] : [{ x: o.x, y: y0 }, { x: o.x, y: y1 }];
          for (const h of heads) {
            const r = this.cell * 0.7;
            const hg = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, r);
            hg.addColorStop(0, `rgba(255,255,255,${hot})`);
            hg.addColorStop(0.4, `rgba(255,225,77,${0.7 * hot})`);
            hg.addColorStop(1, 'rgba(255,225,77,0)');
            ctx.fillStyle = hg;
            ctx.fillRect(h.x - r, h.y - r, r * 2, r * 2);
            if (Math.random() < 0.7) this.burst(h.x, h.y, Math.random() < 0.5 ? '#ffffff' : '#ffe14d', 1, 0.08 + Math.random() * 0.1);
          }
        }
        if (!e.shook) {
          e.shook = true;
          this.shake = { born: now, life: 200, amp: 3 };
        }
        break;
      }
      case 'area': {
        const { x, y } = this.center(...e.at);
        const reach = this.pitch * (e.radius + 0.5);
        const grow = ease.out(Math.min(1, t * 1.6));

        // Fireball: white-hot core through pink and orange, swelling then fading.
        const r = reach * (0.5 + 1.1 * grow);
        if (t < 0.25) {
          // A flash across the board.
          ctx.save();
          this.clipToBoard();
          ctx.fillStyle = `rgba(255,240,200,${0.3 * (1 - t / 0.25)})`;
          ctx.fillRect(0, 0, this.width, this.height);
          ctx.restore();
        }
        const fire = ctx.createRadialGradient(x, y, 0, x, y, r);
        const heat = Math.max(0, 1 - t * 1.2);
        fire.addColorStop(0, `rgba(255,255,255,${0.95 * heat})`);
        fire.addColorStop(0.25, `rgba(255,225,77,${0.85 * heat})`);
        fire.addColorStop(0.55, `rgba(255,61,139,${0.6 * heat})`);
        fire.addColorStop(1, 'rgba(255,61,139,0)');
        ctx.shadowBlur = 0;
        ctx.fillStyle = fire;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);

        // Shockwave ring rolling past the blast area.
        const ring = reach * (0.3 + 1.1 * ease.out(t));
        ctx.strokeStyle = `rgba(255,255,255,${0.9 * fade})`;
        ctx.shadowColor = '#ff3d8b';
        ctx.shadowBlur = 16;
        ctx.lineWidth = 10 * fade + 1;
        ctx.beginPath();
        ctx.arc(x, y, ring, 0, Math.PI * 2);
        ctx.stroke();
        // A second, wider ring a beat behind.
        const ring2 = reach * (0.2 + 1.6 * ease.out(Math.max(0, t - 0.12)));
        ctx.strokeStyle = `rgba(255,225,77,${0.7 * fade})`;
        ctx.lineWidth = 5 * fade + 1;
        ctx.beginPath();
        ctx.arc(x, y, ring2, 0, Math.PI * 2);
        ctx.stroke();

        // Square outline of the cells it takes out, so the reach is clear.
        if (t < 0.6) {
          const box = reach * grow;
          ctx.strokeStyle = `rgba(255,138,31,${0.8 * (1 - t / 0.6)})`;
          ctx.shadowColor = '#ff8a1f';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(x - box, y - box, box * 2, box * 2, 8);
          ctx.stroke();
        }
        break;
      }
      case 'bolt': {
        const from = this.center(...e.from), to = this.center(...e.to);
        // The bolt strikes out to its target fast, then crackles and fades.
        const reach = Math.min(1, t * 4);
        const end = { x: from.x + (to.x - from.x) * reach, y: from.y + (to.y - from.y) * reach };
        const flicker = 0.75 + 0.25 * Math.random();
        const alpha = Math.min(1, fade * 1.6) * flicker;

        // Charged-up aura around the bomb while it's firing.
        const aura = ctx.createRadialGradient(from.x, from.y, 0, from.x, from.y, this.cell * 1.6);
        aura.addColorStop(0, `rgba(255,255,255,${0.55 * alpha})`);
        aura.addColorStop(0.35, `rgba(192,77,255,${0.4 * alpha})`);
        aura.addColorStop(1, 'rgba(192,77,255,0)');
        ctx.fillStyle = aura;
        ctx.fillRect(from.x - this.cell * 1.6, from.y - this.cell * 1.6, this.cell * 3.2, this.cell * 3.2);

        const path = jaggedPath(from, end, 9, Math.min(14, Math.hypot(end.x - from.x, end.y - from.y) * 0.08));
        // Side forks crackling off the main bolt.
        const forks = [];
        for (let f = 0; f < 2; f++) {
          const at = path[2 + Math.floor(Math.random() * (path.length - 4))];
          if (!at) continue;
          const ang = Math.atan2(end.y - from.y, end.x - from.x) + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6);
          const len = this.cell * (0.6 + Math.random() * 0.8);
          forks.push(jaggedPath(at, { x: at.x + Math.cos(ang) * len, y: at.y + Math.sin(ang) * len }, 4, 5));
        }

        // Three passes: wide purple glow, hot magenta, white core.
        const passes = [
          { width: 14, color: `rgba(192,77,255,${0.45 * alpha})`, blur: 30, glow: '#c04dff' },
          { width: 6, color: `rgba(255,120,240,${0.9 * alpha})`, blur: 16, glow: '#ff3d8b' },
          { width: 2.6, color: `rgba(255,255,255,${alpha})`, blur: 8, glow: '#ffffff' },
        ];
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        for (const pass of passes) {
          ctx.strokeStyle = pass.color;
          ctx.shadowColor = pass.glow;
          ctx.shadowBlur = pass.blur;
          ctx.lineWidth = pass.width;
          strokePath(ctx, path);
          ctx.lineWidth = pass.width * 0.55;
          for (const fork of forks) strokePath(ctx, fork);
        }

        // Impact: a white flash on the candy it hits, sparks and a jolt.
        if (reach >= 1) {
          if (!e.struck) {
            e.struck = true;
            for (let i = 0; i < 14; i++) this.burst(to.x, to.y, ['#ffffff', '#c04dff', '#ff7af0'][i % 3], 1, 0.1 + Math.random() * 0.16);
            if (!this.shake || this.shake.amp < 2) this.shake = { born: now, life: 120, amp: 2 };
          }
          const u = Math.min(1, (t - 0.25) / 0.75);
          const flash = ctx.createRadialGradient(to.x, to.y, 0, to.x, to.y, this.cell * (0.35 + 0.35 * u));
          flash.addColorStop(0, `rgba(255,255,255,${0.9 * (1 - u)})`);
          flash.addColorStop(0.5, `rgba(192,77,255,${0.5 * (1 - u)})`);
          flash.addColorStop(1, 'rgba(192,77,255,0)');
          ctx.shadowBlur = 0;
          ctx.fillStyle = flash;
          ctx.fillRect(to.x - this.cell, to.y - this.cell, this.cell * 2, this.cell * 2);
        }
        break;
      }
      case 'jelly': {
        // A cyan flash and ring as a layer of jelly comes off.
        const { x, y } = this.center(...e.at);
        const half = this.cell / 2;
        ctx.fillStyle = `rgba(200,255,255,${0.7 * fade})`;
        ctx.shadowColor = '#2de2e6';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.roundRect(x - half, y - half, this.cell, this.cell, 6);
        ctx.fill();
        const grow = half * (1 + 0.5 * ease.out(t));
        ctx.strokeStyle = `rgba(45,226,230,${fade})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x - grow, y - grow, grow * 2, grow * 2, 8);
        ctx.stroke();
        break;
      }
      case 'spark': {
        const { x, y } = this.center(...e.at);
        const r = this.cell * (0.25 + 0.5 * ease.out(t));
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,255,255,${0.9 * fade})`);
        g.addColorStop(0.5, `rgba(255,225,77,${0.5 * fade})`);
        g.addColorStop(1, 'rgba(255,225,77,0)');
        ctx.shadowBlur = 0;
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        break;
      }
      case 'ring': {
        // A fruit popping: a ring in its color bursting outward.
        const r = this.cell * (0.25 + 0.55 * ease.out(t));
        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowBlur = 0;
        ctx.strokeStyle = e.color;
        ctx.globalAlpha = fade;
        ctx.lineWidth = 5 * fade + 0.5;
        ctx.beginPath();
        ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'dim': {
        // Darken the board while the bomb's lightning plays, so it pops.
        const k = Math.min(1, t * 6, (1 - t) * 4);
        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowBlur = 0;
        this.clipToBoard();
        ctx.fillStyle = `rgba(30,10,60,${0.35 * k})`;
        ctx.fillRect(0, 0, this.width, this.height);
        break;
      }
      case 'board': {
        ctx.fillStyle = `rgba(255,255,255,${0.6 * fade})`;
        ctx.fillRect(0, 0, this.width, this.height);
        break;
      }
    }
    ctx.restore();
  }

  draw(now) {
    const { ctx, dpr, board } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    if (this.outline) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 0.9;
      ctx.drawImage(this.outline, 0, 0);
      ctx.globalAlpha = 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    for (let r = 0; r < board.rows; r++)
      for (let c = 0; c < board.cols; c++) {
        if (!board.mask[r][c]) continue;
        const x = PAD + c * this.pitch, y = PAD + r * this.pitch;
        // Dark tray tiles, so the pieces are the brightest thing on screen.
        ctx.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,.045)' : 'rgba(255,255,255,.11)';
        ctx.beginPath();
        ctx.roundRect(x, y, this.cell, this.cell, 9);
        ctx.fill();
        const layers = this.jellyShown.get(r * 100 + c) ?? board.jelly[r][c];
        if (layers > 0) this.drawJelly(x, y, layers);
        if (board.isExit(r, c)) this.drawExit(x, y, now);
        const shell = this.blockShown.get(r * 100 + c) ?? board.block[r][c];
        if (shell > 0 && this.sprites) {
          const size = SPRITE * (this.cell / BASE_CELL);
          const cx = x + this.cell / 2, cy = y + this.cell / 2;
          const kind = (this.blockTypeShown.get(r * 100 + c) ?? board.blockType[r][c]) === 'mochi' ? 'mochi' : 'coco';
          ctx.drawImage(this.sprites[`${kind}:${Math.min(2, shell)}`], cx - size / 2, cy - size / 2, size, size);
        }
      }

    if (this.aiming) {
      // A golden glow around the board while a booster waits for a target.
      const pulse = 0.5 + 0.5 * Math.sin(now / 180);
      ctx.save();
      ctx.strokeStyle = `rgba(255,207,58,${0.6 + 0.4 * pulse})`;
      ctx.shadowColor = '#ffcf3a';
      ctx.shadowBlur = 10 + 10 * pulse;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(3, 3, this.width - 6, this.height - 6, 22);
      ctx.stroke();
      ctx.restore();
    }

    if (this.selected) {
      const [r, c] = this.selected;
      const x = PAD + c * this.pitch, y = PAD + r * this.pitch;
      const pulse = 0.55 + 0.45 * Math.sin(now / 160);
      ctx.save();
      ctx.fillStyle = `rgba(255,248,200,${0.35 + 0.25 * pulse})`;
      ctx.strokeStyle = `rgba(255,255,255,${0.7 + 0.3 * pulse})`;
      ctx.shadowColor = '#ffcf3a';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x + 1.5, y + 1.5, this.cell - 3, this.cell - 3, 9);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Candies spawning above the board shouldn't show over the frame.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, PAD - 1, this.width, this.height);
    ctx.clip();

    const hintIds = new Set();
    if (this.hint && now - this.hint.since > 0) {
      for (const p of this.hint.pair) {
        const cell = board.get(...p);
        if (cell) hintIds.add(cell.id);
      }
    }
    const k = this.cell / BASE_CELL;
    const size = SPRITE * k;
    for (const [id, v] of this.visuals) {
      if (!this.sprites) break;
      const { x, y } = this.center(v.row, v.col);
      let s = size * v.scale;
      let dx = 0;
      if (hintIds.has(id)) {
        const t = (now - this.hint.since) / 1000;
        s *= 1 + 0.08 * Math.max(0, Math.sin(t * 6));
        dx = Math.sin(t * 18) * 1.2 * Math.max(0, Math.sin(t * 3));
      }
      if (v.flash > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.75 * v.flash;
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(x, y, this.cell * 0.42 * v.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (v.candy.special === 'wrappedLit') {
        // Primed to go off again: throb with a white-hot glow.
        const throb = 0.5 + 0.5 * Math.sin(now / 70);
        s *= 1.05 + 0.1 * throb;
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.35 * throb;
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(x, y, this.cell * 0.36, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // Specials gently pulse so they catch your eye.
      const sp = v.candy.special;
      if (sp && sp !== 'ingredient' && sp !== 'wrappedLit' && !v.override) {
        s *= 1 + 0.045 * Math.sin(now / 240 + v.candy.id);
      }
      // Squash and stretch, keeping roughly the same volume, settled on its
      // bottom so a landing candy squashes into the floor.
      const j = v.j ?? 0, st = v.stretch ?? 0;
      const sy = (1 - j) * (1 - st);
      const sx = (1 + j * 0.85) * (1 + st * 0.6);
      const w = s * sx, h = s * sy;
      const sink = (s - h) * 0.3;
      ctx.globalAlpha = v.alpha;
      ctx.drawImage(this.sprites[v.override ?? spriteKey(v.candy)], x - w / 2 + dx, y - h / 2 + sink, w, h);
    }
    ctx.globalAlpha = 1;
    // Cages over the locked fruit.
    if (this.sprites)
      for (let r = 0; r < board.rows; r++)
        for (let c = 0; c < board.cols; c++) {
          if (!board.lock[r][c] && !this.lockShown.has(r * 100 + c)) continue;
          const { x, y } = this.center(r, c);
          ctx.drawImage(this.sprites.lock, x - size / 2, y - size / 2, size, size);
        }
    this.drawPortals(now);
    ctx.restore();

    for (const e of this.effects) this.drawEffect(e, now);

    for (const p of this.particles) {
      const age = (now - p.born) / p.life;
      ctx.globalAlpha = 1 - age;
      if (p.text) {
        const pop = age < 0.15 ? 0.6 + (age / 0.15) * 0.6 : 1.2 - Math.min(0.2, (age - 0.15) * 0.5);
        ctx.font = `${Math.round(24 * pop)}px "Lilita One", "Fredoka", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 6;
        ctx.strokeStyle = p.stroke ?? '#c42a6e';
        ctx.strokeText(p.text, p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y);
      } else if (p.kind === 'confetti') {
        // A paper chip tumbling: its width flips as it turns.
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.scale(Math.cos(p.angle * 2.3), 1);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size * 0.35, p.size, p.size * 0.7);
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - age * 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    ctx.globalAlpha = 1;
  }
}
