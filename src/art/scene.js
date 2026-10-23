// Scenery for the hot-spring world: palm trees, clouds, hills, pools,
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

// Rolling hills strip, viewBox 0 0 440 160.
export function hills() {
  return wrap('0 0 440 160',
    `<path d="M0 80 C60 30 120 30 180 70 C240 110 300 20 360 40 C400 54 420 70 440 64 L440 160 L0 160Z" fill="#9be36e"/>` +
    `<path d="M0 110 C70 70 140 80 200 104 C260 128 330 78 440 96 L440 160 L0 160Z" fill="#6fcf4e"/>` +
    `<path d="M0 136 C80 116 160 124 240 138 C320 152 380 126 440 130 L440 160 L0 160Z" fill="#4cb53b"/>`);
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

// viewBox 0 0 120 60
export function bush() {
  return wrap('0 0 120 60',
    `<g fill="#4cb53b" stroke="#2a7a1e" stroke-width="2.5"><circle cx="30" cy="38" r="22"/><circle cx="60" cy="28" r="26"/><circle cx="92" cy="38" r="22"/></g>` +
    `<rect x="12" y="38" width="98" height="22" fill="#4cb53b"/>` +
    `<circle cx="50" cy="20" r="5" fill="#fff" opacity=".35"/><circle cx="84" cy="30" r="4" fill="#fff" opacity=".3"/>`);
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

// A sun with a face, viewBox 0 0 100 100.
export function sun() {
  return wrap('0 0 100 100',
    `<circle cx="50" cy="50" r="34" fill="url(#sun)" stroke="#e08a00" stroke-width="3"/>` +
    `<ellipse cx="40" cy="46" rx="3" ry="4" fill="#7a3d00"/><ellipse cx="60" cy="46" rx="3" ry="4" fill="#7a3d00"/>` +
    `<path d="M42 58 Q50 64 58 58" stroke="#7a3d00" stroke-width="3" fill="none" stroke-linecap="round"/>` +
    `<ellipse cx="34" cy="56" rx="5" ry="3" fill="#ff8f6b" opacity=".7"/><ellipse cx="66" cy="56" rx="5" ry="3" fill="#ff8f6b" opacity=".7"/>`,
    `<radialGradient id="sun" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fff6b0"/><stop offset=".6" stop-color="#ffd23f"/><stop offset="1" stop-color="#ffb000"/></radialGradient>`);
}
