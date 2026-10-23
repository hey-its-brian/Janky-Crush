// Turns the SVG piece art (src/art/pieces.js) into canvas sprites once per
// screen resolution, so a frame is just drawImage calls.
//
// (The old Night Arcade candies are in git history; they'll come back as an
// optional theme.)

import { FRUIT_KEYS, fruit, striped, wrapped, bomb, ducky, pup } from '../art/pieces.js';

// Particle and effect colors per fruit: [main, light, deep].
export const PALETTE = {
  r: ['#ff2d4a', '#ff9aa0', '#a8001a'],
  o: ['#ff9a1f', '#ffe0a0', '#c65400'],
  y: ['#ffd92e', '#fffbd0', '#c99a00'],
  g: ['#74d63c', '#eaffb8', '#2b8212'],
  b: ['#2f86ff', '#b6ddff', '#0b3a9c'],
  p: ['#9b4dff', '#ecc8ff', '#4a148c'],
};

// Sprite box in CSS px for a 42px cell. Everything is drawn centered in
// it; specials fill more of the box so their glow spills past the cell.
export const SPRITE = 64;
const FILL = { fruit: 0.7, special: 0.94, ingredient: 0.74 };

export function spriteKey(candy) {
  if (candy.special === 'bomb') return 'bomb';
  if (candy.special === 'ingredient') return `ing:${candy.kind}`;
  if (!candy.special) return candy.color;
  return `${candy.color}:${candy.special === 'wrappedLit' ? 'wrapped' : candy.special}`;
}

function sources() {
  const out = [];
  for (const k of FRUIT_KEYS) {
    out.push([k, fruit(k), FILL.fruit]);
    out.push([`${k}:stripeH`, striped(k, 'h'), FILL.special]);
    out.push([`${k}:stripeV`, striped(k, 'v'), FILL.special]);
    out.push([`${k}:wrapped`, wrapped(k), FILL.special]);
  }
  out.push(['bomb', bomb(), FILL.special]);
  out.push(['ing:duck', ducky(), FILL.ingredient]);
  out.push(['ing:pup', pup(), FILL.ingredient]);
  return out;
}

async function rasterize(svgText, px, fill) {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = px;
  const size = px * fill;
  canvas.getContext('2d').drawImage(img, (px - size) / 2, (px - size) / 2, size, size);
  return canvas;
}

// Resolves to { key: canvas } at `scale` device pixels per CSS px.
export async function buildSprites(scale) {
  const px = Math.ceil(SPRITE * scale);
  const entries = await Promise.all(sources().map(async ([key, svgText, fill]) => [key, await rasterize(svgText, px, fill)]));
  return Object.fromEntries(entries);
}
