// Draws the board on a canvas and animates the steps the game loop hands it.
// Visual state (where each candy is drawn) is kept separately from the
// board, so animations can move candies between logical positions.

import { buildSprites, spriteKey, PALETTE, SPRITE } from './sprites.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PAD = 7;
const GAP = 2;
const BASE_CELL = 42; // the cell size the sprites were drawn for

const ease = {
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  inQuad: (t) => t * t,
  out: (t) => 1 - (1 - t) ** 3,
};

// A small settle at the end of a fall, like the candy lands and squashes.
function fallEase(t) {
  if (t < 0.82) return ease.inQuad(t / 0.82);
  const u = (t - 0.82) / 0.18;
  return 1 + Math.sin(u * Math.PI) * 0.06;
}

export class Renderer {
  constructor(canvas, board) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.board = board;
    this.visuals = new Map();
    this.tweens = [];
    this.particles = [];
    this.effects = [];
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
    this.effects = this.effects.filter((e) => now - e.born < e.life);
    this.draw(now);
    const lit = [...this.visuals.values()].some((v) => v.candy.special === 'wrappedLit');
    const busy = this.tweens.length || this.particles.length || this.effects.length || lit || this.selected || this.hint;
    if (busy) requestAnimationFrame((t) => this.frame(t));
    else this.running = false;
  }

  // ---- steps --------------------------------------------------------------

  // Both take board positions before the board itself is swapped.
  swapMover(a, b) {
    const va = this.visualAt(a), vb = this.visualAt(b);
    return (k) => {
      if (va) { va.row = a[0] + (b[0] - a[0]) * k; va.col = a[1] + (b[1] - a[1]) * k; }
      if (vb) { vb.row = b[0] + (a[0] - b[0]) * k; vb.col = b[1] + (a[1] - b[1]) * k; }
    };
  }

  animateSwap(a, b) {
    return this.tween(170, this.swapMover(a, b));
  }

  // Swap there and back, for a swap that doesn't match.
  async animateBadSwap(a, b) {
    const move = this.swapMover(a, b);
    await this.tween(170, move);
    await this.tween(170, (k) => move(1 - k));
  }

  // Animate one resolution step from Board.resolveStep / comboStep.
  async animateStep(step, points) {
    const now = performance.now();
    for (const b of step.blasts) this.effects.push({ ...b, born: now, life: b.kind === 'bolts' ? 520 : 380 });
    this.requestDraw();

    // Bolts and converted candies get a beat to be seen before they pop.
    if (step.converted.length || step.blasts.some((b) => b.kind === 'bolts' || b.kind === 'board')) {
      await sleep(step.converted.length ? 380 : 240);
    }

    const many = step.cleared.length > 20;
    for (const cell of step.cleared) {
      const { x, y } = this.center(...cell.at);
      this.burst(x, y, cell.color ? PALETTE[cell.color][0] : '#f1edff', many ? 3 : 7);
    }

    if (points) {
      const anchor = step.created[0]?.at ?? step.groups[0]?.cells[1] ?? step.cleared[0]?.at;
      if (anchor) {
        const { x, y } = this.center(...anchor);
        this.particles.push({ text: `+${points}`, x, y, vx: 0, vy: -0.035, life: 900, born: performance.now(), color: '#f1edff' });
      }
    }

    // New specials pop in where they formed.
    const made = step.created.map((m) => this.visuals.get(m.candy.id)).filter(Boolean);
    const pop = this.tween(320, (k) => {
      for (const v of made) v.scale = 1 + 0.45 * Math.sin(k * Math.PI);
    }, (t) => t);

    const vs = step.cleared.map((cell) => this.visuals.get(cell.id)).filter(Boolean);
    const clear = this.tween(210, (k) => {
      for (const v of vs) {
        v.scale = k < 0.3 ? 1 + k : 1.3 * (1 - (k - 0.3) / 0.7);
        v.alpha = 1 - k * k;
      }
    }, (t) => t).then(() => step.cleared.forEach((cell) => this.visuals.delete(cell.id)));

    await Promise.all([pop, clear]);
  }

  animateFall(moves, spawns) {
    for (const s of spawns)
      this.visuals.set(s.id, { candy: s.candy, row: s.fromRow, col: s.to[1], scale: 1, alpha: 1 });
    const jobs = [
      ...moves.map((m) => ({ v: this.visuals.get(m.id), from: m.from[0], to: m.to[0] })),
      ...spawns.map((s) => ({ v: this.visuals.get(s.id), from: s.fromRow, to: s.to[0] })),
    ].filter((j) => j.v);
    return Promise.all(
      jobs.map((j) => {
        const dist = j.to - j.from;
        return this.tween(140 + 70 * Math.sqrt(dist), (k) => (j.v.row = j.from + dist * k), fallEase);
      })
    );
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

  burst(x, y, color, count = 7) {
    const now = performance.now();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.06 + Math.random() * 0.08;
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

  // Blast effects: beams for stripes, a shockwave for wrapped, lightning for
  // the color bomb, and a flash when two bombs clear the board.
  drawEffect(e, now) {
    const { ctx } = this;
    const t = (now - e.born) / e.life;
    const fade = 1 - t;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = '#2de2e6';
    ctx.shadowBlur = 18;
    switch (e.kind) {
      case 'row':
      case 'col': {
        const span = this.cell * (0.9 - 0.6 * t);
        const { x, y } = this.center(e.kind === 'row' ? e.index : 0, e.kind === 'col' ? e.index : 0);
        const g = e.kind === 'row'
          ? ctx.createLinearGradient(0, y - span / 2, 0, y + span / 2)
          : ctx.createLinearGradient(x - span / 2, 0, x + span / 2, 0);
        g.addColorStop(0, 'rgba(45,226,230,0)');
        g.addColorStop(0.5, `rgba(255,255,255,${0.95 * fade})`);
        g.addColorStop(1, 'rgba(45,226,230,0)');
        ctx.fillStyle = g;
        if (e.kind === 'row') ctx.fillRect(0, y - span / 2, this.width, span);
        else ctx.fillRect(x - span / 2, 0, span, this.height);
        break;
      }
      case 'area': {
        const { x, y } = this.center(...e.at);
        const reach = this.pitch * (e.radius + 0.5);
        const size = reach * (0.4 + 0.8 * ease.out(t));
        ctx.strokeStyle = `rgba(255,61,139,${fade})`;
        ctx.shadowColor = '#ff3d8b';
        ctx.lineWidth = 4 * fade + 1;
        ctx.beginPath();
        ctx.roundRect(x - size, y - size, size * 2, size * 2, 10);
        ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${0.25 * fade})`;
        ctx.fill();
        break;
      }
      case 'bolts': {
        const from = this.center(...e.at);
        ctx.strokeStyle = `rgba(241,237,255,${fade})`;
        ctx.shadowColor = '#c04dff';
        ctx.lineWidth = 2;
        for (const p of e.targets) {
          const to = this.center(...p);
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          // A few jittered kinks so it reads as electricity.
          for (let i = 1; i < 4; i++) {
            const f = i / 4;
            const jitter = (Math.random() - 0.5) * 10;
            ctx.lineTo(from.x + (to.x - from.x) * f + jitter, from.y + (to.y - from.y) * f - jitter);
          }
          ctx.lineTo(to.x, to.y);
          ctx.stroke();
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
      ctx.globalAlpha = v.alpha;
      ctx.drawImage(this.sprites[spriteKey(v.candy)], x - s / 2 + dx, y - s / 2, s, s);
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
