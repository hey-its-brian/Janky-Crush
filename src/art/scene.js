// Small moving scenery for the map and the level scene: steam, butterflies
// and birds. Each returns a standalone SVG string. Animation (rising steam,
// flapping wings) is done with CSS on the element that holds the SVG.

const wrap = (vb, body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"><defs>${defs}</defs>${body}</svg>`;

// A wisp of steam, viewBox 0 0 40 90. Animate it rising and fading.
export function steam() {
  return wrap('0 0 40 90',
    `<path d="M20 88 C6 72 34 62 20 46 C8 32 30 22 20 4" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" opacity=".85"/>`);
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

// A little bird in flight, viewBox 0 0 30 14. Wings flap via CSS on .wing.
export function bird() {
  return wrap('0 0 30 14',
    `<path class="wing" d="M2 8 Q8 0 15 8 Q22 0 28 8" stroke="#5a2d0c" stroke-width="2.5" fill="none" stroke-linecap="round"/>`);
}
