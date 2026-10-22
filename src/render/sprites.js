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

function drawCandy(ctx, k) {
  const [base, light, deep] = PALETTE[k];
  const shape = shapeFor(k);

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

  if (k === 'b' && ctx.createConicGradient) {
    const swirl = ctx.createConicGradient(0.2, 0, 0);
    for (let i = 0; i < 8; i++) {
      swirl.addColorStop(i / 8, 'rgba(255,255,255,.4)');
      swirl.addColorStop(i / 8 + 0.05, 'rgba(255,255,255,0)');
    }
    ctx.fillStyle = swirl;
    ctx.fillRect(-24, -24, 48, 48);
  }
  if (k === 'p') {
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

export function buildSprites(dpr) {
  const sprites = {};
  for (const k of Object.keys(PALETTE)) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.ceil(SPRITE * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.translate(SPRITE / 2, SPRITE / 2);
    drawCandy(ctx, k);
    sprites[k] = canvas;
  }
  return sprites;
}
