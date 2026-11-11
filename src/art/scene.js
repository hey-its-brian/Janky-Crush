// Scenery for the map and the level scene: palm trees, clouds, pools,
// flowers, butterflies and steam. Each returns a standalone SVG string.
// Animation (sway, drift, bob, rising steam) is done with CSS on the
// element that holds the SVG.

const wrap = (vb, body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"><defs>${defs}</defs>${body}</svg>`;

// viewBox 0 0 140 240: the trunk's base is at (70, 236).
export function palm(flip = false) {
  const fronds = [
    'M70 34 C50 18 22 20 6 34 C26 30 46 34 70 42Z',
    'M70 34 C56 8 30 0 14 6 C34 12 52 22 70 40Z',
    'M70 34 C78 6 100 -2 118 4 C100 12 86 22 72 40Z',
    'M70 34 C92 18 120 22 136 36 C116 32 94 34 70 42Z',
    'M70 36 C88 40 108 58 112 80 C100 62 86 52 70 44Z',
    'M70 36 C52 40 32 58 28 80 C40 62 54 52 70 44Z',
  ].map((d) => `<path d="${d}" fill="#3fbf4a" stroke="#1d6b22" stroke-width="2.5" stroke-linejoin="round"/>`).join('');
  const rings = [60, 84, 108, 132, 156, 180, 204, 226]
    .map((y, i) => `<path d="M${62 + i * 0.6} ${y} q8 4 16 0" stroke="#8a5530" stroke-width="2" fill="none"/>`).join('');
  return wrap('0 0 140 240',
    `<g ${flip ? 'transform="translate(140 0) scale(-1 1)"' : ''}>` +
    `<path d="M66 40 C60 100 62 170 56 236 L80 236 C80 170 78 100 76 40Z" fill="#c98a4b" stroke="#6b3f1c" stroke-width="2.5"/>` +
    rings + fronds +
    `<circle cx="64" cy="44" r="7" fill="#7a4a1c" stroke="#4a2a10" stroke-width="2"/>` +
    `<circle cx="76" cy="46" r="7" fill="#7a4a1c" stroke="#4a2a10" stroke-width="2"/>` +
    `</g>`);
}

// viewBox 0 0 160 80
export function cloud() {
  return wrap('0 0 160 80',
    `<g fill="#fff" stroke="#cfeaf7" stroke-width="3">` +
    `<ellipse cx="50" cy="52" rx="38" ry="22"/><ellipse cx="88" cy="40" rx="36" ry="30"/>` +
    `<ellipse cx="122" cy="54" rx="30" ry="20"/><rect x="30" y="50" width="104" height="24" rx="12" stroke="none"/></g>` +
    `<ellipse cx="78" cy="30" rx="16" ry="6" fill="#fff" opacity=".9"/>`);
}

// A steaming hot-spring pool, viewBox 0 0 200 90.
export function pool() {
  const rocks = [[10, 50, 12], [30, 66, 13], [58, 76, 12], [92, 80, 13], [126, 78, 12], [158, 70, 13], [186, 54, 12], [176, 32, 10], [20, 30, 10]]
    .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.8}" fill="#b9b2c8" stroke="#6e6680" stroke-width="2"/>`).join('');
  return wrap('0 0 200 90',
    `<ellipse cx="100" cy="48" rx="92" ry="36" fill="url(#water)" stroke="#2aa7b8" stroke-width="3"/>` +
    `<ellipse cx="78" cy="40" rx="30" ry="6" fill="#fff" opacity=".45"/>` +
    `<ellipse cx="130" cy="56" rx="20" ry="4" fill="#fff" opacity=".35"/>` + rocks,
    `<radialGradient id="water" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#9ff3f2"/>` +
    `<stop offset=".6" stop-color="#46d1dc"/><stop offset="1" stop-color="#1fa4b8"/></radialGradient>`);
}

// A wisp of steam, viewBox 0 0 40 90. Animate it rising and fading.
export function steam() {
  return wrap('0 0 40 90',
    `<path d="M20 88 C6 72 34 62 20 46 C8 32 30 22 20 4" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" opacity=".85"/>`);
}

// viewBox 0 0 40 40
export function flower(petal = '#ff6fae') {
  const petals = [0, 72, 144, 216, 288]
    .map((a) => `<ellipse cx="20" cy="9" rx="7" ry="9" transform="rotate(${a} 20 20)" fill="${petal}" stroke="#b03a72" stroke-width="1.5"/>`).join('');
  return wrap('0 0 40 40', petals + `<circle cx="20" cy="20" r="6" fill="#ffe14d" stroke="#c99a00" stroke-width="1.5"/>`);
}

// viewBox 0 0 40 30. Wings flap via CSS scaleX on .wing.
export function butterfly(color = '#8b5cf6') {
  return wrap('0 0 40 30',
    `<g class="wing"><ellipse cx="12" cy="12" rx="10" ry="9" fill="${color}" stroke="#3a1a5c" stroke-width="1.5"/>` +
    `<ellipse cx="28" cy="12" rx="10" ry="9" fill="${color}" stroke="#3a1a5c" stroke-width="1.5"/>` +
    `<ellipse cx="14" cy="22" rx="6" ry="5" fill="${color}" stroke="#3a1a5c" stroke-width="1.5"/>` +
    `<ellipse cx="26" cy="22" rx="6" ry="5" fill="${color}" stroke="#3a1a5c" stroke-width="1.5"/></g>` +
    `<rect x="18.5" y="6" width="3" height="20" rx="1.5" fill="#3a1a5c"/>`);
}

// A striped hot-air balloon, viewBox 0 0 80 110.
export function balloon() {
  const stripes = ['#ff5fa2', '#ffcf3a', '#2ec4d6', '#ffcf3a', '#ff5fa2'];
  const segs = stripes.map((c, i) => {
    const x0 = 6 + i * 13.6, x1 = x0 + 13.6;
    return `<path d="M40 70 C${x0 - 6} 52 ${x0} 10 ${(x0 + x1) / 2} 6 C${x1} 10 ${x1 + 6} 52 40 70Z" fill="${c}"/>`;
  }).join('');
  return wrap('0 0 80 110',
    `<g clip-path="url(#bl)">${segs}</g>` +
    `<path d="M40 70 C8 52 2 26 12 14 C22 2 58 2 68 14 C78 26 72 52 40 70Z" fill="none" stroke="#8a1748" stroke-width="2.5"/>` +
    `<ellipse cx="28" cy="22" rx="7" ry="10" fill="#fff" opacity=".35"/>` +
    `<path d="M32 70 L34 86 M48 70 L46 86" stroke="#6b3f1c" stroke-width="2"/>` +
    `<rect x="31" y="86" width="18" height="14" rx="3" fill="#c98a4b" stroke="#6b3f1c" stroke-width="2.5"/>`,
    `<clipPath id="bl"><path d="M40 70 C8 52 2 26 12 14 C22 2 58 2 68 14 C78 26 72 52 40 70Z"/></clipPath>`);
}

// A cluster of rounded rocks, viewBox 0 0 70 40.
export function rocks() {
  return wrap('0 0 70 40',
    `<g stroke="#6e6680" stroke-width="2.5">` +
    `<ellipse cx="22" cy="28" rx="18" ry="11" fill="#c9c2d6"/>` +
    `<ellipse cx="46" cy="26" rx="16" ry="13" fill="#b9b2c8"/>` +
    `<ellipse cx="36" cy="32" rx="12" ry="7" fill="#d8d2e2"/></g>` +
    `<ellipse cx="42" cy="18" rx="5" ry="3" fill="#fff" opacity=".5"/>`);
}

// A little bird in flight, viewBox 0 0 30 14. Wings flap via CSS on .wing.
export function bird() {
  return wrap('0 0 30 14',
    `<path class="wing" d="M2 8 Q8 0 15 8 Q22 0 28 8" stroke="#5a2d0c" stroke-width="2.5" fill="none" stroke-linecap="round"/>`);
}
