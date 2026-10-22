// Draws the board on a canvas and animates the steps the game loop hands it.
// Visual state (where each candy is drawn) is kept separately from the
// board, so animations can move candies between logical positions.

import { buildSprites, PALETTE, SPRITE } from './sprites.js';

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
        if (cell) this.visuals.set(cell.id, { color: cell.color, row: r, col: c, scale: 1, alpha: 1 });
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
    this.draw(now);
    const busy = this.tweens.length || this.particles.length || this.selected || this.hint;
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

  animateClear(removed, groups, points) {
    for (const cell of removed) {
      const { x, y } = this.center(...cell.at);
      this.burst(x, y, PALETTE[cell.color][0]);
    }
    if (groups.length && points) {
      const g = groups[0].cells;
      const mid = g[Math.floor(g.length / 2)];
      const { x, y } = this.center(...mid);
      this.particles.push({ text: `+${points}`, x, y, vx: 0, vy: -0.035, life: 900, born: performance.now(), color: '#f1edff' });
    }
    const vs = removed.map((cell) => this.visuals.get(cell.id)).filter(Boolean);
    return this.tween(210, (k) => {
      for (const v of vs) {
        v.scale = k < 0.3 ? 1 + k : 1.3 * (1 - (k - 0.3) / 0.7);
        v.alpha = 1 - k * k;
      }
    }, (t) => t).then(() => removed.forEach((cell) => this.visuals.delete(cell.id)));
  }

  animateFall(moves, spawns) {
    for (const s of spawns)
      this.visuals.set(s.id, { color: s.color, row: s.fromRow, col: s.to[1], scale: 1, alpha: 1 });
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

  burst(x, y, color) {
    const now = performance.now();
    for (let i = 0; i < 7; i++) {
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
      ctx.globalAlpha = v.alpha;
      ctx.drawImage(this.sprites[v.color], x - s / 2 + dx, y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

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
