// Board pieces as SVG: six fruits, their specials, ingredients and the
// color bomb. Each function returns a standalone SVG document (viewBox
// 0 0 100 100) so it can be drawn into a canvas or dropped into the page.
//
// Every piece has a soft drop shadow, a darker outline and a glossy
// highlight so it pops off the glass board.

let uid = 0;
const id = (name) => `${name}-${++uid}`;

const SHADOW = `<ellipse cx="50" cy="91" rx="27" ry="5.5" fill="#3a1a00" opacity=".22"/>`;

function svg(defs, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<defs>${defs}</defs>${body}</svg>`;
}

// Radial gradient lit from the upper left: light → base → deep.
function shade(name, light, base, deep) {
  return `<radialGradient id="${name}" cx=".36" cy=".3" r=".8">` +
    `<stop offset="0" stop-color="${light}"/><stop offset=".45" stop-color="${base}"/>` +
    `<stop offset="1" stop-color="${deep}"/></radialGradient>`;
}

const gloss = (cx, cy, rx, ry, rot = -30, o = 0.7) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})" fill="#fff" opacity="${o}"/>`;

const leaf = (d) => `<path d="${d}" fill="#4cc94f" stroke="#1d6b22" stroke-width="2" stroke-linejoin="round"/>`;

// ---- the six fruits (color keys match the engine: r o y g b p) ------------

const FRUITS = {
  // Strawberry
  r: () => {
    const g = id('sb');
    const seeds = [[38, 48], [50, 45], [62, 48], [32, 60], [44, 58], [56, 58], [68, 60], [40, 70], [52, 70], [62, 70], [47, 80], [56, 80]]
      .map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="1.7" ry="2.6" transform="rotate(${(i % 3 - 1) * 15} ${x} ${y})" fill="#fff1b0"/>`).join('');
    return svg(shade(g, '#ff9aa0', '#ff2d4a', '#a8001a'),
      SHADOW +
      `<path d="M50 92 C30 88 12 66 14 47 C15 34 28 28 40 31 C45 32 48 34 50 34 C52 34 55 32 60 31 C72 28 85 34 86 47 C88 66 70 88 50 92Z" fill="url(#${g})" stroke="#80001a" stroke-width="2.5"/>` +
      seeds +
      leaf('M50 22 L56 31 L68 26 L62 36 L73 39 L58 40 L50 45 L42 40 L27 39 L38 36 L32 26 L44 31Z') +
      `<path d="M50 24 L51 13" stroke="#2f7d1f" stroke-width="4" stroke-linecap="round"/>` +
      gloss(32, 52, 6, 11, -25));
  },
  // Orange
  o: () => {
    const g = id('or');
    const dots = [[40, 66], [60, 70], [68, 50], [32, 58], [52, 80], [62, 58], [44, 76]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4" fill="#ffc46b" opacity=".8"/>`).join('');
    return svg(shade(g, '#ffe0a0', '#ff9a1f', '#c65400'),
      SHADOW +
      `<circle cx="50" cy="55" r="34" fill="url(#${g})" stroke="#9a4100" stroke-width="2.5"/>` + dots +
      `<path d="M50 23 L50 15" stroke="#6b3d14" stroke-width="4" stroke-linecap="round"/>` +
      leaf('M51 18 C58 6 76 7 80 13 C72 21 60 23 51 18Z') +
      gloss(37, 41, 10, 6.5, -32));
  },
  // Lemon
  y: () => {
    const g = id('le');
    return svg(shade(g, '#fffbd0', '#ffd92e', '#c99a00'),
      SHADOW +
      `<g transform="rotate(-20 50 55)"><path d="M7 55 C13 51 15 45 20 40 C28 30 39 27 50 27 C61 27 72 30 80 40 C85 45 87 51 93 55 C87 59 85 65 80 70 C72 80 61 83 50 83 C39 83 28 80 20 70 C15 65 13 59 7 55Z" fill="url(#${g})" stroke="#9a7300" stroke-width="2.5"/>` +
      gloss(36, 44, 12, 6, -6) + `</g>`);
  },
  // Green apple
  g: () => {
    const g = id('ap');
    return svg(shade(g, '#eaffb8', '#74d63c', '#2b8212'),
      SHADOW +
      `<path d="M50 34 C44 26 30 24 21 32 C11 42 13 63 21 75 C29 87 41 91 50 87 C59 91 71 87 79 75 C87 63 89 42 79 32 C70 24 56 26 50 34Z" fill="url(#${g})" stroke="#1d6b0c" stroke-width="2.5"/>` +
      `<path d="M50 34 C50 26 52 20 56 15" stroke="#6b3d14" stroke-width="4" fill="none" stroke-linecap="round"/>` +
      leaf('M55 22 C62 11 77 13 79 19 C71 26 61 28 55 22Z') +
      gloss(32, 50, 7, 12, -20));
  },
  // Blueberry
  b: () => {
    const g = id('bb');
    return svg(shade(g, '#b6ddff', '#2f86ff', '#0b3a9c'),
      SHADOW +
      `<circle cx="50" cy="55" r="34" fill="url(#${g})" stroke="#082a73" stroke-width="2.5"/>` +
      `<circle cx="50" cy="55" r="33" fill="#cfe6ff" opacity=".08"/>` +
      `<path d="M50 20 L54 27 L62 25 L58 32 L64 37 L55 37 L50 43 L45 37 L36 37 L42 32 L38 25 L46 27Z" fill="#163f99" stroke="#082a73" stroke-width="2" stroke-linejoin="round"/>` +
      gloss(36, 47, 9, 6, -35));
  },
  // Grapes
  p: () => {
    const g = id('gr');
    const berries = [[49, 85], [39, 71], [59, 71], [31, 56], [49, 56], [67, 55], [39, 41], [58, 40]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="12.5" fill="url(#${g})" stroke="#3a0d73" stroke-width="2"/>` +
        `<ellipse cx="${x - 4}" cy="${y - 5}" rx="3.6" ry="2.4" transform="rotate(-30 ${x - 4} ${y - 5})" fill="#fff" opacity=".7"/>`)
      .reverse().join('');
    return svg(shade(g, '#ecc8ff', '#9b4dff', '#4a148c'),
      SHADOW +
      `<path d="M49 30 C49 22 52 16 56 12" stroke="#6b3d14" stroke-width="4" fill="none" stroke-linecap="round"/>` +
      berries +
      leaf('M55 22 C63 12 78 14 80 20 C72 27 62 28 55 22Z'));
  },
};

export const FRUIT_KEYS = Object.keys(FRUITS);

export function fruit(color) {
  return FRUITS[color]();
}

// The fruit's SVG body without the outer <svg>, so specials can wrap it.
function inner(color) {
  return fruit(color).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
}

// Striped: juicy streaks across the fruit. dir 'h' clears a row, 'v' a column.
export function striped(color, dir) {
  const clip = id('clip');
  const bands = [40, 52, 64].map((y) =>
    `<rect x="10" y="${y}" width="80" height="6" rx="3" fill="#fff" opacity=".92"/>`).join('');
  const rot = dir === 'v' ? 'rotate(90 50 55)' : '';
  return svg(`<clipPath id="${clip}"><circle cx="50" cy="56" r="31"/></clipPath>`,
    inner(color) +
    `<g clip-path="url(#${clip})"><g transform="${rot}" style="filter:drop-shadow(0 0 2px #fff)">${bands}</g></g>`);
}

// Wrapped: the fruit sealed in a soap bubble.
export function wrapped(color) {
  const g = id('bub');
  return svg(
    `<radialGradient id="${g}" cx=".5" cy=".5" r=".5"><stop offset=".6" stop-color="#bff4ff" stop-opacity="0"/>` +
    `<stop offset=".92" stop-color="#9fe8ff" stop-opacity=".55"/><stop offset="1" stop-color="#ffffff" stop-opacity=".9"/></radialGradient>`,
    `<g transform="translate(50 54) scale(.78) translate(-50 -54)">${inner(color)}</g>` +
    `<circle cx="50" cy="52" r="45" fill="url(#${g})" stroke="#fff" stroke-width="2.5"/>` +
    `<path d="M20 38 C24 26 34 17 46 14" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".9"/>` +
    `<circle cx="74" cy="76" r="3.5" fill="#fff" opacity=".8"/>`);
}

// Color bomb: a sparkly dragonfruit.
export function bomb() {
  const g = id('df');
  const scales = [
    [50, 20, 0], [30, 30, -40], [70, 30, 40], [20, 52, -80], [80, 52, 80],
    [32, 76, -130], [68, 76, 130], [50, 52, 0], [38, 62, -20], [62, 62, 20],
  ].map(([x, y, r]) =>
    `<path d="M${x} ${y} c-5 -2 -6 -10 0 -16 c6 6 5 14 0 16z" transform="rotate(${r} ${x} ${y})" fill="#5fd35a" stroke="#1d6b22" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M${x} ${y - 13} l0 -4" transform="rotate(${r} ${x} ${y})" stroke="#ffe14d" stroke-width="2.5" stroke-linecap="round"/>`).join('');
  const sparkle = (x, y, s, c) =>
    `<path d="M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s}Z" fill="${c}"/>`;
  return svg(shade(g, '#ffd1ec', '#ff3d9a', '#a3005a'),
    SHADOW +
    `<ellipse cx="50" cy="56" rx="31" ry="34" fill="url(#${g})" stroke="#7a0042" stroke-width="2.5"/>` +
    scales + gloss(37, 42, 8, 5, -35, 0.75) +
    sparkle(16, 18, 7, '#fff') + sparkle(86, 26, 6, '#ffe14d') + sparkle(84, 84, 7, '#fff') + sparkle(14, 80, 5, '#9fe8ff'));
}

// Ingredient: a rubber ducky.
export function ducky() {
  const g = id('dk');
  return svg(shade(g, '#fff6b0', '#ffd21f', '#d99a00'),
    SHADOW +
    `<path d="M14 62 C14 50 26 46 38 50 C46 52 56 52 66 48 C80 44 88 54 86 66 C84 80 70 88 50 88 C30 88 14 78 14 62Z" fill="url(#${g})" stroke="#9a6a00" stroke-width="2.5"/>` +
    `<circle cx="58" cy="36" r="19" fill="url(#${g})" stroke="#9a6a00" stroke-width="2.5"/>` +
    `<path d="M74 38 C84 36 90 40 88 44 C84 48 76 46 72 44Z" fill="#ff8a1f" stroke="#a84a00" stroke-width="2"/>` +
    `<circle cx="64" cy="32" r="3.6" fill="#1e1208"/><circle cx="65.2" cy="30.6" r="1.2" fill="#fff"/>` +
    `<path d="M30 64 C38 58 50 60 54 68 C46 72 36 72 30 64Z" fill="#ffc400" stroke="#9a6a00" stroke-width="2"/>` +
    `<ellipse cx="52" cy="40" rx="4" ry="2.4" fill="#ff8fb0" opacity=".7"/>` +
    gloss(48, 28, 6, 3.5, -30));
}

// Ingredient: a capybara pup's head (boxy, sleepy-eyed, like the host).
export function pup() {
  const lid = (x) =>
    `<ellipse cx="${x}" cy="44" rx="4.2" ry="4.2" fill="#1e1208"/><circle cx="${x + 1.4}" cy="45" r="1.3" fill="#fff"/>` +
    `<path d="M${x - 5} 43 Q${x} 37 ${x + 5} 43 L${x + 5} 40 Q${x} 34 ${x - 5} 40Z" fill="#c4864f"/>` +
    `<path d="M${x - 5} 43 Q${x} 39.5 ${x + 5} 43" stroke="#4a2a14" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  return svg('',
    SHADOW +
    `<ellipse cx="27" cy="25" rx="6" ry="4.6" transform="rotate(-15 27 25)" fill="#8a5530" stroke="#6b3f1c" stroke-width="2"/>` +
    `<ellipse cx="73" cy="25" rx="6" ry="4.6" transform="rotate(15 73 25)" fill="#8a5530" stroke="#6b3f1c" stroke-width="2"/>` +
    `<path d="M12 46 C12 32 22 26 36 26 L64 26 C78 26 88 32 88 46 L88 66 C88 80 78 88 64 88 L36 88 C22 88 12 80 12 66Z" fill="#c4864f" stroke="#6b3f1c" stroke-width="2.5"/>` +
    `<path d="M22 66 C22 56 32 52 50 52 C68 52 78 56 78 66 C78 78 66 85 50 85 C34 85 22 78 22 66Z" fill="#d6995f"/>` +
    `<rect x="37" y="54" width="26" height="10" rx="5" fill="#4a2a14"/>` +
    `<path d="M44 72 Q47 76 50 72 Q53 76 56 72" stroke="#4a2a14" stroke-width="2.2" fill="none" stroke-linecap="round"/>` +
    lid(34) + lid(66) +
    `<ellipse cx="20" cy="58" rx="5.5" ry="3.4" fill="#ff8fb0" opacity=".7"/>` +
    `<ellipse cx="80" cy="58" rx="5.5" ry="3.4" fill="#ff8fb0" opacity=".7"/>` +
    `<circle cx="50" cy="20" r="9" fill="#ffb02e" stroke="#a84a00" stroke-width="2"/>` +
    `<path d="M51 12 C55 6 63 7 64 10 C60 14 55 14 51 12Z" fill="#4cc94f" stroke="#1d6b22" stroke-width="1.5"/>` +
    gloss(30, 33, 7, 3.5, -20, 0.3));
}
