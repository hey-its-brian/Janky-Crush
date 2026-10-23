// Pre-renders each candy once per device pixel ratio, so a frame is just
// drawImage calls. Look: glossy hard candy with a neon glow (Night Arcade).

export const PALETTE = {
  //       base       light      deep
  r: ['#ff3d6b', '#ffb3c4', '#3d0a1a'],
  o: ['#ff8a1f', '#ffd0a0', '#3d1f05'],
  y: ['#ffe14d', '#fff5b8', '#3d3305'],
  g: ['#3dff8a', '#b8ffd5', '#053d1c'],
  b: ['#2db8ff', '#b3e6ff', '#05283d'],
  p: ['#c04dff', '#e9b8ff', '#2a053d'],
};

// Sprite box in CSS px; the candy itself is ~36px, the rest is glow room.
export const SPRITE = 64;

function rotated(path, deg) {
  const out = new Path2D();
  out.addPath(path, new DOMMatrix().rotate(deg));
  return out;
}

function shapeFor(k) {
  const p = new Path2D();
  switch (k) {
    case 'r': // jellybean
      p.moveTo(-17, -1);
      p.bezierCurveTo(-17, -13, 1, -16, 10, -11);
      p.bezierCurveTo(19, -6, 19, 9, 9, 12);
      p.bezierCurveTo(2, 14, -3, 9, -9, 10);
      p.bezierCurveTo(-15, 11, -17, 6, -17, -1);
      p.closePath();
      return rotated(p, -12);
    case 'o': // lozenge
      p.roundRect(-13, -13, 26, 26, 7);
      return rotated(p, 45);
    case 'y': // lemon drop
      p.ellipse(0, 0, 17, 13, 0, 0, Math.PI * 2);
      return rotated(p, -25);
    case 'g': // square gummy
      p.roundRect(-15, -15, 30, 30, 9);
      return p;
    case 'b': // round swirl
      p.arc(0, 0, 16, 0, Math.PI * 2);
      return p;
    case 'p': { // cut gem
      const w = 17, h = 15;
      p.moveTo(-w / 2, -h); p.lineTo(w / 2, -h); p.lineTo(w, 0);
      p.lineTo(w / 2, h); p.lineTo(-w / 2, h); p.lineTo(-w, 0);
      p.closePath();
      return p;
    }
  }
  throw new Error(`unknown candy ${k}`);
}

function hexA(hex, a) {
  return hex + Math.round(a * 255).toString(16).padStart(2, '0');
}

// `stripes` is 'h' or 'v' for a striped candy. `shape` lets the wrapped
// candy reuse the same glossy body on its own outline.
function drawCandy(ctx, k, { shape = shapeFor(k), stripes = null, swirl = k === 'b', facet = k === 'p' } = {}) {
  const [base, light, deep] = PALETTE[k];

  // Neon glow: two passes, tight then wide.
  ctx.save();
  ctx.fillStyle = base;
  ctx.shadowColor = hexA(base, 0.6);
  ctx.shadowBlur = 14;
  ctx.fill(shape);
  ctx.shadowColor = base;
  ctx.shadowBlur = 5;
  ctx.fill(shape);
  ctx.restore();

  ctx.save();
  ctx.clip(shape);

  // Body: lit from the upper left, deep translucent edge.
  const body = ctx.createRadialGradient(-5, -6, 1, -2, -2, 22);
  body.addColorStop(0, light);
  body.addColorStop(0.28, base);
  body.addColorStop(1, deep);
  ctx.fillStyle = body;
  ctx.fillRect(-24, -24, 48, 48);

  if (swirl && ctx.createConicGradient) {
    const swirl = ctx.createConicGradient(0.2, 0, 0);
    for (let i = 0; i < 8; i++) {
      swirl.addColorStop(i / 8, 'rgba(255,255,255,.4)');
      swirl.addColorStop(i / 8 + 0.05, 'rgba(255,255,255,0)');
    }
    ctx.fillStyle = swirl;
    ctx.fillRect(-24, -24, 48, 48);
  }
  if (facet) {
    const facet = ctx.createLinearGradient(-17, -15, 17, 15);
    facet.addColorStop(0, 'rgba(255,255,255,.3)');
    facet.addColorStop(0.36, 'rgba(255,255,255,.3)');
    facet.addColorStop(0.37, 'rgba(255,255,255,0)');
    ctx.fillStyle = facet;
    ctx.fillRect(-24, -24, 48, 48);
  }

  // Colored bounce light near the bottom: reads as translucent candy.
  const bounce = ctx.createRadialGradient(4, 11, 0, 4, 11, 12);
  bounce.addColorStop(0, hexA(light, 0.6));
  bounce.addColorStop(1, hexA(light, 0));
  ctx.fillStyle = bounce;
  ctx.fillRect(-24, -24, 48, 48);

  // Bottom shading.
  const shade = ctx.createLinearGradient(0, 2, 0, 18);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,.35)');
  ctx.fillStyle = shade;
  ctx.fillRect(-24, -24, 48, 48);

  // Candy-cane bands, with a soft glow so they read at a glance.
  if (stripes) {
    ctx.save();
    if (stripes === 'v') ctx.rotate(Math.PI / 2);
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 4;
    ctx.fillStyle = 'rgba(255,255,255,.88)';
    for (const y of [-9, -1.5, 6]) ctx.fillRect(-24, y, 48, 3.5);
    ctx.restore();
  }

  // Specular highlight.
  ctx.save();
  ctx.translate(-6, -8);
  ctx.scale(1, 0.62);
  const shine = ctx.createRadialGradient(0, 0, 0, 0, 0, 8);
  shine.addColorStop(0, 'rgba(255,255,255,.95)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.fillRect(-12, -12, 24, 24);
  ctx.restore();

  // Rim light (half the stroke lands inside the clip).
  ctx.strokeStyle = hexA(light, 0.65);
  ctx.lineWidth = 3;
  ctx.stroke(shape);
  ctx.restore();
}

// A sweet in a twist wrapper: glossy square body with twisted ends.
function drawWrapped(ctx, k) {
  const [base, light] = PALETTE[k];
  const ends = new Path2D();
  for (const s of [-1, 1]) {
    ends.moveTo(s * 10, -4);
    ends.lineTo(s * 22, -11);
    ends.quadraticCurveTo(s * 18, 0, s * 22, 11);
    ends.lineTo(s * 10, 4);
    ends.closePath();
  }
  ctx.save();
  ctx.shadowColor = base;
  ctx.shadowBlur = 8;
  const g = ctx.createLinearGradient(0, -11, 0, 11);
  g.addColorStop(0, light);
  g.addColorStop(0.5, base);
  g.addColorStop(1, light);
  ctx.fillStyle = g;
  ctx.fill(ends);
  ctx.restore();

  const body = new Path2D();
  body.roundRect(-13, -13, 26, 26, 8);
  drawCandy(ctx, k, { shape: body, swirl: false, facet: false });

  // The wrapper's edge: a bright band around the body.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.85)';
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 6;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  const band = new Path2D();
  band.roundRect(-10, -10, 20, 20, 6);
  ctx.stroke(band);
  ctx.restore();
}

// Color bomb: glossy chocolate ball covered in neon sprinkles.
const SPRINKLES = [
  [-8, -5, 0.4, 'r'], [3, -10, -0.6, 'y'], [9, -2, 1.1, 'b'], [-3, 4, -1.2, 'g'],
  [6, 8, 0.3, 'p'], [-10, 6, 1.4, 'o'], [-1, -3, 2.0, 'b'], [11, 5, -0.2, 'r'],
  [-6, 11, 0.8, 'y'], [2, 12, -1.0, 'g'], [-12, -1, 0.0, 'p'], [5, -4, 1.6, 'o'],
];

function drawBomb(ctx) {
  const ball = new Path2D();
  ball.arc(0, 0, 16, 0, Math.PI * 2);

  ctx.save();
  ctx.shadowColor = 'rgba(241,237,255,.85)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#2a140a';
  ctx.fill(ball);
  ctx.restore();

  ctx.save();
  ctx.clip(ball);
  const body = ctx.createRadialGradient(-5, -6, 1, -2, -2, 20);
  body.addColorStop(0, '#9a5a35');
  body.addColorStop(0.35, '#5a2e17');
  body.addColorStop(1, '#1a0b05');
  ctx.fillStyle = body;
  ctx.fillRect(-20, -20, 40, 40);

  for (const [x, y, rot, k] of SPRINKLES) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.shadowColor = PALETTE[k][0];
    ctx.shadowBlur = 4;
    ctx.fillStyle = PALETTE[k][1];
    ctx.beginPath();
    ctx.roundRect(-3, -1, 6, 2.2, 1.1);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(-6, -8);
  ctx.scale(1, 0.62);
  const shine = ctx.createRadialGradient(0, 0, 0, 0, 0, 8);
  shine.addColorStop(0, 'rgba(255,255,255,.8)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.fillRect(-12, -12, 24, 24);
  ctx.restore();
  ctx.restore();
}

// Glossy ball with a highlight, for ingredients.
function glossyBall(ctx, x, y, r, base, light, deep) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, light);
  g.addColorStop(0.35, base);
  g.addColorStop(1, deep);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.35, y - r * 0.42, r * 0.28, r * 0.16, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

// Ingredient: a pair of cherries on a stem, with a gold glow so it reads
// as "not a candy".
function drawCherry(ctx) {
  ctx.save();
  ctx.shadowColor = '#ffe14d';
  ctx.shadowBlur = 12;
  ctx.strokeStyle = '#3dff8a';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-7, 3);
  ctx.quadraticCurveTo(-4, -10, 3, -15);
  ctx.moveTo(8, 4);
  ctx.quadraticCurveTo(7, -8, 3, -15);
  ctx.stroke();
  ctx.fillStyle = '#3dff8a';
  ctx.beginPath();
  ctx.ellipse(8, -15, 6, 2.6, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.shadowColor = '#ff3d6b';
  ctx.shadowBlur = 8;
  glossyBall(ctx, -7, 7, 9, '#ff2d55', '#ffc2cf', '#5a0617');
  glossyBall(ctx, 8, 8, 9, '#ff2d55', '#ffc2cf', '#5a0617');
  ctx.restore();
}

// Ingredient: a hazelnut with its cap.
function drawNut(ctx) {
  ctx.save();
  ctx.shadowColor = '#ffe14d';
  ctx.shadowBlur = 12;
  const g = ctx.createRadialGradient(-5, -2, 2, 0, 3, 17);
  g.addColorStop(0, '#f0b27a');
  g.addColorStop(0.45, '#b5652b');
  g.addColorStop(1, '#3d1c08');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 4, 14, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  // Cap.
  const cap = ctx.createLinearGradient(0, -14, 0, -2);
  cap.addColorStop(0, '#8a5a2b');
  cap.addColorStop(1, '#4a2a10');
  ctx.fillStyle = cap;
  ctx.beginPath();
  ctx.ellipse(0, -5, 14, 6.5, 0, Math.PI, Math.PI * 2);
  ctx.lineTo(14, -4);
  ctx.quadraticCurveTo(0, 0, -14, -4);
  ctx.fill();
  ctx.strokeStyle = '#4a2a10';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(1, -16);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.beginPath();
  ctx.ellipse(-6, 4, 3.5, 2, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Sprite keys: 'r' (plain), 'r:stripeH', 'r:stripeV', 'r:wrapped', 'bomb'.
export function spriteKey(candy) {
  if (candy.special === 'bomb') return 'bomb';
  if (candy.special === 'ingredient') return `ing:${candy.kind}`;
  if (!candy.special) return candy.color;
  return `${candy.color}:${candy.special === 'wrappedLit' ? 'wrapped' : candy.special}`;
}

export function buildSprites(dpr) {
  const sprites = {};
  const make = (name, paint) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.ceil(SPRITE * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.translate(SPRITE / 2, SPRITE / 2);
    paint(ctx);
    sprites[name] = canvas;
  };
  for (const k of Object.keys(PALETTE)) {
    make(k, (ctx) => drawCandy(ctx, k));
    make(`${k}:stripeH`, (ctx) => drawCandy(ctx, k, { stripes: 'h', swirl: false }));
    make(`${k}:stripeV`, (ctx) => drawCandy(ctx, k, { stripes: 'v', swirl: false }));
    make(`${k}:wrapped`, (ctx) => drawWrapped(ctx, k));
  }
  make('bomb', drawBomb);
  make('ing:cherry', drawCherry);
  make('ing:nut', drawNut);
  return sprites;
}
