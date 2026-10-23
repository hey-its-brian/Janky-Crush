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
const WINDUP_MS = 170;
const EXPLOSION_MS = 700;
const WAVE_MS_PER_CELL = 70;

// The player reads what happened from these, so they're deliberately
// unhurried.
const CLEAR_MS = 420;           // flash, swell, shrink away
const BEAM_MS = 700;            // stripe beam life
const BEAM_MS_PER_CELL = 38;    // how fast a beam sweeps outward
const MORPH_MS = 380;           // a candy turning into a special
const BOLT_GAP_MAX = 110;       // between bomb bolts...
const BOLT_TOTAL_MAX = 1500;    // ...but all of them land within this
const PRIMED_HOLD_MS = 450;     // converted specials sit on screen before firing
const CHAIN_GAP_MAX = 220;      // between blasts in a chain...
const CHAIN_TOTAL_MAX = 2400;   // ...capped for very long chains

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
// drop takes ~150ms and a long drop speeds up and hits hard.
const GRAVITY = 90;
const START_SPEED = 6;      // cells/s: a nudge so one-cell drops aren't sluggish
const BOUNCE = 0.14;        // how much of the landing speed bounces back
const MAX_HOP_SPEED = 5;    // cells/s, so even big drops only hop a little
const STACK_DELAY_MS = 24;  // candies in a column fall a hair apart

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
    this.selected = null;
    this.hint = null;
    this.running = false;
    this.resize();
    this.sync();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
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
    if (this.spriteDpr !== dpr) {
      // Sprites are drawn a bit larger than 1:1 when the cell is bigger than
      // the design size, so scale the backing resolution with it.
      this.sprites = buildSprites(dpr * Math.max(1, this.cell / BASE_CELL));
      this.spriteDpr = dpr;
    }
    this.requestDraw();
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
    const lit = [...this.visuals.values()].some((v) => v.candy.special === 'wrappedLit');
    const busy = this.jiggling.size || shaking || this.tweens.length || this.particles.length || this.effects.length || lit || this.selected || this.hint;
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
    const move = this.swapMover(a, b);
    await this.tween(190, move);
    move.settle();
  }

  // Swap there and back, for a swap that doesn't match.
  async animateBadSwap(a, b) {
    const move = this.swapMover(a, b);
    await this.tween(190, move);
    move.settle();
    await sleep(60);
    await this.tween(190, (k) => move(1 - k));
    move.settle();
  }

  // Animate one resolution step from Board.resolveStep / comboStep /
  // firePrimed. Blasts go off one after another so chain reactions ripple,
  // and each candy pops when the blast that hit it arrives.
  async animateStep(step, points) {
    const t0 = performance.now();
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

    step.blasts.forEach((b, i) => {
      if (b.kind === 'bolts') {
        b.targets.forEach((to, j) =>
          this.effects.push({ kind: 'bolt', from: b.at, to, born: t0 + blastAt[i] + j * boltGap(b), life: 480 }));
      } else if (b.kind === 'area') {
        this.effects.push({ ...b, born: t0 + blastAt[i] + WINDUP_MS, life: EXPLOSION_MS });
        jobs.push(this.detonate(b, blastAt[i]));
      } else {
        this.effects.push({ ...b, born: t0 + blastAt[i], life: b.kind === 'board' ? 500 : BEAM_MS });
      }
    });
    this.requestDraw();

    if (points) {
      const anchor = step.created[0]?.at ?? step.groups[0]?.cells[1] ?? step.cleared[0]?.at;
      if (anchor) {
        const { x, y } = this.center(...anchor);
        this.particles.push({ text: `+${points}`, x, y, vx: 0, vy: -0.03, life: 1200, born: t0, color: '#f1edff' });
      }
    }

    // Bomb + special: as each bolt lands, that candy turns into the special.
    if (step.converted.length) {
      const i = step.blasts.findIndex((b) => b.kind === 'bolts');
      const b = step.blasts[i];
      let last = 0;
      for (const c of step.converted) {
        const v = this.visuals.get(c.candy.id);
        if (!v) continue;
        v.override = c.candy.color;
        const at = boltLands(i, Math.max(0, b.targets.findIndex((p) => sameCell(p, c.at))));
        last = Math.max(last, at);
        jobs.push(sleep(at).then(() => this.morph(v)));
      }
      // Let every new special sit on screen before they go off.
      jobs.push(sleep(last + MORPH_MS + PRIMED_HOLD_MS));
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
        this.burst(px, py, x.color ? PALETTE[x.color][0] : '#f1edff', many ? 4 : 8);
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

    // New specials pop in where they formed.
    for (const m of step.created) {
      const v = this.visuals.get(m.candy.id);
      if (v) jobs.push(this.pop(v));
    }

    await Promise.all(jobs);
    // Let the last bolts and beams finish before things fall.
    const tail = Math.max(0, ...this.effects.map((e) => e.born + e.life * 0.6)) - performance.now();
    if (tail > 0) await sleep(tail);
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
    if (v) await this.tween(WINDUP_MS, (k) => (v.scale = 1 + 0.4 * k), ease.inQuad);
    if (v && v.candy.special === 'wrappedLit') v.scale = 1;
    const { x, y } = this.center(...blast.at);
    const colors = ['#ffffff', '#ff3d8b', '#ff8a1f', '#ffe14d'];
    for (let i = 0; i < 26; i++) this.burst(x, y, colors[i % colors.length], 1, 0.12 + Math.random() * 0.16);
    this.shake = { born: performance.now(), life: 320, amp: 3 + blast.radius * 2 };
    this.requestDraw();
  }

  pop(v) {
    this.jiggle(v, -0.16);
    return this.tween(300, (k) => (v.scale = 1 + 0.45 * Math.sin(k * Math.PI)), (t) => t);
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
    for (const s of spawns)
      this.visuals.set(s.id, { candy: s.candy, row: s.fromRow, col: s.to[1], scale: 1, alpha: 1 });
    const jobs = [
      ...moves.map((m) => ({ v: this.visuals.get(m.id), from: m.from[0], to: m.to[0] })),
      ...spawns.map((s) => ({ v: this.visuals.get(s.id), from: s.fromRow, to: s.to[0] })),
    ].filter((j) => j.v);
    const landed = new Map(); // "row,col" -> visual, for the jiggle below
    for (const v of this.visuals.values()) if (Number.isInteger(v.row)) landed.set(`${v.row},${v.col}`, v);
    for (const j of jobs) landed.delete(`${j.v.row},${j.v.col}`);

    // Bottom of each column first, so candies pile in rather than moving
    // as one block.
    const stack = new Map();
    jobs.sort((p, q) => q.to - p.to);
    for (const j of jobs) {
      const n = stack.get(j.v.col) ?? 0;
      stack.set(j.v.col, n + 1);
      j.delay = n * STACK_DELAY_MS;
    }
    return Promise.all(jobs.map((j) => sleep(j.delay).then(() => this.drop(j, landed))));
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
      const below = landed.get(`${j.to + 1},${v.col}`);
      if (below) this.jiggle(below, Math.min(0.1, 0.002 * impact + 0.02));
      landed.set(`${j.to},${v.col}`, v);
    };
    return this.tween(total, (_, t) => {
      const sec = (t * total) / 1000;
      if (sec < tFall) {
        v.row = j.from + v0 * sec + 0.5 * GRAVITY * sec * sec;
        v.stretch = -Math.min(0.12, 0.004 * (v0 + GRAVITY * sec)); // drawn out by speed
      } else {
        land();
        const u = sec - tFall;
        v.row = j.to - (hop * u - 0.5 * GRAVITY * u * u);
      }
    }, (t) => t).then(() => {
      land();
      v.row = j.to;
      v.stretch = 0;
    });
  }

  animateShuffle(moves) {
    if (!moves) {
      this.sync();
      return Promise.resolve();
    }
    const jobs = moves.map((m) => ({ v: this.visuals.get(m.id), m })).filter((j) => j.v);
    return this.tween(450, (k) => {
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

  setHint(pair) {
    this.hint = pair ? { pair, since: performance.now() } : null;
    this.requestDraw();
  }

  // ---- particles ----------------------------------------------------------

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
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  // ---- drawing ------------------------------------------------------------

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
        const span = this.cell * (0.95 - 0.55 * t);
        const g = row
          ? ctx.createLinearGradient(0, o.y - span / 2, 0, o.y + span / 2)
          : ctx.createLinearGradient(o.x - span / 2, 0, o.x + span / 2, 0);
        g.addColorStop(0, 'rgba(45,226,230,0)');
        g.addColorStop(0.5, `rgba(255,255,255,${0.95 * fade})`);
        g.addColorStop(1, 'rgba(45,226,230,0)');
        ctx.fillStyle = g;
        if (row) {
          const x0 = Math.max(0, o.x - reach), x1 = Math.min(this.width, o.x + reach);
          ctx.fillRect(x0, o.y - span / 2, x1 - x0, span);
        } else {
          const y0 = Math.max(0, o.y - reach), y1 = Math.min(this.height, o.y + reach);
          ctx.fillRect(o.x - span / 2, y0, span, y1 - y0);
        }
        break;
      }
      case 'area': {
        const { x, y } = this.center(...e.at);
        const reach = this.pitch * (e.radius + 0.5);
        const grow = ease.out(Math.min(1, t * 1.6));

        // Fireball: white-hot core through pink and orange, swelling then fading.
        const r = reach * (0.35 + 0.85 * grow);
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
        ctx.lineWidth = 6 * fade + 1;
        ctx.beginPath();
        ctx.arc(x, y, ring, 0, Math.PI * 2);
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
        const aura = ctx.createRadialGradient(from.x, from.y, 0, from.x, from.y, this.cell * 0.9);
        aura.addColorStop(0, `rgba(255,255,255,${0.35 * alpha})`);
        aura.addColorStop(0.4, `rgba(192,77,255,${0.25 * alpha})`);
        aura.addColorStop(1, 'rgba(192,77,255,0)');
        ctx.fillStyle = aura;
        ctx.fillRect(from.x - this.cell, from.y - this.cell, this.cell * 2, this.cell * 2);

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
          { width: 9, color: `rgba(192,77,255,${0.35 * alpha})`, blur: 26, glow: '#c04dff' },
          { width: 4, color: `rgba(255,120,240,${0.75 * alpha})`, blur: 12, glow: '#ff3d8b' },
          { width: 1.8, color: `rgba(255,255,255,${alpha})`, blur: 6, glow: '#ffffff' },
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
            for (let i = 0; i < 8; i++) this.burst(to.x, to.y, i % 2 ? '#ffffff' : '#c04dff', 1, 0.1 + Math.random() * 0.12);
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

    for (let r = 0; r < board.rows; r++)
      for (let c = 0; c < board.cols; c++) {
        if (!board.mask[r][c]) continue;
        const x = PAD + c * this.pitch, y = PAD + r * this.pitch;
        ctx.fillStyle = (r + c) % 2 ? '#151130' : '#1a1638';
        ctx.beginPath();
        ctx.roundRect(x, y, this.cell, this.cell, 5);
        ctx.fill();
      }

    if (this.selected) {
      const [r, c] = this.selected;
      const x = PAD + c * this.pitch, y = PAD + r * this.pitch;
      const pulse = 0.55 + 0.45 * Math.sin(now / 160);
      ctx.save();
      ctx.strokeStyle = `rgba(45,226,230,${0.5 + 0.5 * pulse})`;
      ctx.shadowColor = '#2de2e6';
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, this.cell - 2, this.cell - 2, 5);
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
    ctx.restore();

    for (const e of this.effects) this.drawEffect(e, now);

    for (const p of this.particles) {
      const age = (now - p.born) / p.life;
      ctx.globalAlpha = 1 - age;
      if (p.text) {
        ctx.font = '700 18px "Chakra Petch", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#ff3d8b';
        ctx.shadowBlur = 8;
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y);
        ctx.shadowBlur = 0;
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
