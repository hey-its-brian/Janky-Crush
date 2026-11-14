// Builds the canvas sprites once per screen resolution, so a frame is just
// drawImage calls. Fruits are rendered 3D images (art/pieces/*.png); the
// rest, and any fruit whose image is missing, is SVG art from
// src/art/pieces.js.
//
// (The old Night Arcade candies are in git history; they'll come back as an
// optional theme.)

import { FRUIT_KEYS, PIECE_PICTURES, fruit, striped, wrapped, bomb, ducky, pup, coconut, mochi, gummy, cage, pieceImage, specialBack, specialFront, bombBack, bombFront } from '../art/pieces.js';

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
const FILL = { fruit: 0.84, special: 0.94, ingredient: 0.84, coconut: 0.86 };
// Image sprites are cropped to the piece, so this is the piece's real size:
// about 88% of a cell.
const IMAGE_FILL = 0.58;

// One color for each portal on a board, so its two ends match.
export const PORTAL_COLORS = ['#7cf3ff', '#c79bff', '#ffd45e', '#7dffb0', '#ff9ad0'];
const PORTAL_PICTURE = './art/pieces/portal.webp';

export function spriteKey(candy) {
  if (candy.special === 'bomb') return 'bomb';
  if (candy.special === 'ingredient') return `ing:${candy.kind}`;
  if (candy.special === 'gummy') return 'gummy';
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
  out.push(['coco:1', coconut(1), FILL.coconut]);
  out.push(['coco:2', coconut(2), FILL.coconut]);
  out.push(['mochi:1', mochi(1), FILL.coconut]);
  out.push(['mochi:2', mochi(2), FILL.coconut]);
  out.push(['gummy', gummy(), FILL.coconut]);
  out.push(['lock', cage(), 0.66]); // as big as a cell
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

// The piece pictures, loaded once. A missing one resolves to null.
let images = null;
function loadImages() {
  images ??= Promise.all([...FRUIT_KEYS, ...Object.values(PIECE_PICTURES)].map(async (k) => {
    const img = new Image();
    img.src = pieceImage(k);
    try { await img.decode(); return [k, img]; } catch { return [k, null]; }
  })).then(Object.fromEntries);
  return images;
}

function blank(px) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = px;
  return canvas;
}

// Draws the fruit image centered in a sprite box, on a soft contact shadow.
function drawPiece(ctx, img, px, size, stripes) {
  const x = (px - size) / 2, y = (px - size) / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(10, 4, 30, .38)';
  ctx.filter = `blur(${px * 0.025}px)`;
  ctx.beginPath();
  ctx.ellipse(px / 2, y + size * 0.97, size * 0.36, size * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (!stripes) return ctx.drawImage(img, x, y, size, size);
  // Stripes: white bands painted only where the fruit is.
  const off = blank(px);
  const o = off.getContext('2d');
  o.drawImage(img, x, y, size, size);
  o.globalCompositeOperation = 'source-atop';
  o.translate(px / 2, px / 2);
  if (stripes === 'v') o.rotate(Math.PI / 2);
  o.fillStyle = 'rgba(255, 255, 255, .92)';
  o.shadowColor = '#fff';
  o.shadowBlur = px * 0.04;
  for (const f of [-0.2, 0, 0.2]) {
    o.beginPath();
    o.roundRect(-size / 2, f * size - size * 0.05, size, size * 0.1, size * 0.05);
    o.fill();
  }
  ctx.drawImage(off, 0, 0);
}

async function imageSprites(k, img, px) {
  const size = px * IMAGE_FILL;
  const base = blank(px);
  drawPiece(base.getContext('2d'), img, px, size);
  const special = async (kind, pieceSize, stripes) => {
    const [back, front] = await Promise.all([
      rasterize(specialBack(k, kind), px, FILL.special),
      rasterize(specialFront(kind), px, FILL.special),
    ]);
    const canvas = blank(px);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(back, 0, 0);
    drawPiece(ctx, img, px, pieceSize, stripes);
    ctx.drawImage(front, 0, 0);
    return canvas;
  };
  return [
    [k, base],
    [`${k}:stripeH`, await special('striped', size, 'h')],
    [`${k}:stripeV`, await special('striped', size, 'v')],
    [`${k}:wrapped`, await special('wrapped', size * 0.82)],
  ];
}

// A piece that is not a fruit: its picture on a contact shadow. The color
// bomb also gets its rainbow glow and twinkles.
async function pictureSprite(key, img, px) {
  const canvas = blank(px);
  const ctx = canvas.getContext('2d');
  if (key === 'lock') { // the cage is as big as a cell and sits on the fruit: no ground shadow
    const size = px * 0.67;
    ctx.drawImage(img, (px - size) / 2, (px - size) / 2, size, size);
    return [key, canvas];
  }
  if (key === 'bomb') ctx.drawImage(await rasterize(bombBack(), px, FILL.special), 0, 0);
  drawPiece(ctx, img, px, px * (key === 'bomb' ? 0.54 : key.startsWith('ing:') ? 0.6 : 0.62));
  if (key === 'bomb') ctx.drawImage(await rasterize(bombFront(), px, FILL.special), 0, 0);
  return [key, canvas];
}

// The swirl inside a portal, once in each portal color. The picture is
// white light; the color goes over it and a little white stays on top.
async function portalSprites(px) {
  const img = new Image();
  img.src = PORTAL_PICTURE;
  try { await img.decode(); } catch { return []; }
  return PORTAL_COLORS.map((color) => {
    const canvas = blank(px);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, px, px);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, px, px);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35;
    ctx.drawImage(img, 0, 0, px, px);
    return [`portal:${color}`, canvas];
  });
}

// Resolves to { key: canvas } at `scale` device pixels per CSS px.
export async function buildSprites(scale) {
  const px = Math.ceil(SPRITE * scale);
  const loaded = await loadImages();
  const svgSprites = sources()
    .filter(([key]) => !loaded[key.split(':')[0]] && !loaded[PIECE_PICTURES[key]])
    .map(async ([key, svgText, fill]) => [key, await rasterize(svgText, px, fill)]);
  const imgSprites = FRUIT_KEYS.filter((k) => loaded[k]).map((k) => imageSprites(k, loaded[k], px));
  const pictures = Object.entries(PIECE_PICTURES).filter(([, name]) => loaded[name]).map(([key, name]) => pictureSprite(key, loaded[name], px));
  const entries = [...await Promise.all(svgSprites), ...(await Promise.all(imgSprites)).flat(), ...await Promise.all(pictures), ...await portalSprites(px)];
  return Object.fromEntries(entries);
}
