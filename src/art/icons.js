// Small UI icons as SVG strings: coin, heart (lives), the boosters and the
// prize wheel.
// Same soft, glossy style as the fruit. Each copy gets its own gradient id:
// a gradient defined inside a hidden screen doesn't paint anywhere else.

let n = 0;

export function coin() {
  const id = `cn${++n}`;
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="${id}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff6b8"/><stop offset=".5" stop-color="#ffcf3a"/><stop offset="1" stop-color="#e59400"/></radialGradient></defs>
  <circle cx="32" cy="34" r="27" fill="#b06a00"/>
  <circle cx="32" cy="31" r="27" fill="url(#${id})" stroke="#a35f00" stroke-width="3"/>
  <circle cx="32" cy="31" r="19" fill="none" stroke="#e59400" stroke-width="3"/>
  <path d="M26 21c-5 6-5 14 0 20M38 21c5 6 5 14 0 20" stroke="#a35f00" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <path d="M27 31h10" stroke="#a35f00" stroke-width="3.5" stroke-linecap="round"/>
  <ellipse cx="22" cy="18" rx="7" ry="4" fill="#fff" opacity=".7" transform="rotate(-30 22 18)"/>
</svg>`;
}

export function heart() {
  const id = `ht${++n}`;
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="${id}" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#ffc1dc"/><stop offset=".5" stop-color="#ff4f9a"/><stop offset="1" stop-color="#c8165f"/></radialGradient></defs>
  <path d="M32 58C10 43 4 31 6 21 8 10 21 6 32 17 43 6 56 10 58 21c2 10-4 22-26 37z" fill="url(#${id})" stroke="#8a1748" stroke-width="3.5" stroke-linejoin="round"/>
  <ellipse cx="19" cy="19" rx="7" ry="4.5" fill="#fff" opacity=".75" transform="rotate(-35 19 19)"/>
</svg>`;
}

// Smash: a wooden tiki mallet.
export function mallet() {
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <path d="M30 30 50 56" stroke="#7a4a1c" stroke-width="9" stroke-linecap="round"/>
  <path d="M30 30 50 56" stroke="#c9884a" stroke-width="5" stroke-linecap="round"/>
  <g transform="rotate(-38 26 24)">
    <rect x="6" y="13" width="40" height="22" rx="9" fill="#a8652c" stroke="#5e3410" stroke-width="3.5"/>
    <rect x="6" y="13" width="9" height="22" rx="4" fill="#7a4a1c"/>
    <rect x="37" y="13" width="9" height="22" rx="4" fill="#7a4a1c"/>
    <path d="M15 18h22" stroke="#e0a868" stroke-width="3" stroke-linecap="round"/>
  </g>
</svg>`;
}

// Switch: two fruit-colored arrows trading places.
export function switcher() {
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 26c4-10 26-14 36-4" fill="none" stroke="#1d7a8a" stroke-width="10" stroke-linecap="round"/>
  <path d="M12 26c4-10 26-14 36-4" fill="none" stroke="#3fd1e6" stroke-width="5.5" stroke-linecap="round"/>
  <path d="M52 12l-1 15-14-4z" fill="#3fd1e6" stroke="#1d7a8a" stroke-width="3" stroke-linejoin="round"/>
  <path d="M52 38c-4 10-26 14-36 4" fill="none" stroke="#8a1748" stroke-width="10" stroke-linecap="round"/>
  <path d="M52 38c-4 10-26 14-36 4" fill="none" stroke="#ff5fa2" stroke-width="5.5" stroke-linecap="round"/>
  <path d="M12 52l1-15 14 4z" fill="#ff5fa2" stroke="#8a1748" stroke-width="3" stroke-linejoin="round"/>
</svg>`;
}

// Shuffle: a little whirlpool.
export function whirl() {
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="26" fill="#bdf3ff" stroke="#1d7a8a" stroke-width="3.5"/>
  <path d="M32 32c0-4 6-4 6 1 0 6-9 8-12 2-4-8 4-15 12-13 10 3 12 15 6 22-7 8-22 6-27-4" fill="none" stroke="#1d7a8a" stroke-width="7" stroke-linecap="round"/>
  <path d="M32 32c0-4 6-4 6 1 0 6-9 8-12 2-4-8 4-15 12-13 10 3 12 15 6 22-7 8-22 6-27-4" fill="none" stroke="#2ec4d6" stroke-width="3.5" stroke-linecap="round"/>
</svg>`;
}

// Sweep: two golden beams that cross, with an arrow head on each end.
export function sweeper() {
  const arm = (r) => `<g transform="rotate(${r} 32 32)"><path d="M32 12v40" stroke="#a35300" stroke-width="12" stroke-linecap="round"/><path d="M32 12v40" stroke="#ffcf3a" stroke-width="7" stroke-linecap="round"/><path d="M32 3l10 12H22z" fill="#ffcf3a" stroke="#a35300" stroke-width="3" stroke-linejoin="round"/><path d="M32 61l10-12H22z" fill="#ffcf3a" stroke="#a35300" stroke-width="3" stroke-linejoin="round"/></g>`;
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  ${arm(0)}${arm(90)}
  <circle cx="32" cy="32" r="9" fill="#fff6b8" stroke="#a35300" stroke-width="3"/>
  <circle cx="29.5" cy="29.5" r="3" fill="#fff"/>
</svg>`;
}

// Picker: a woven basket with three fruit in it.
export function basket() {
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 30c0-16 36-16 36 0" fill="none" stroke="#7a4a1c" stroke-width="5" stroke-linecap="round"/>
  <circle cx="22" cy="28" r="9" fill="#ff4f6a" stroke="#8a1730" stroke-width="3"/>
  <circle cx="42" cy="28" r="9" fill="#4f8dff" stroke="#1d3f9a" stroke-width="3"/>
  <circle cx="32" cy="24" r="10" fill="#ffa62e" stroke="#a35300" stroke-width="3"/>
  <ellipse cx="29" cy="20" rx="3.5" ry="2.2" fill="#fff" opacity=".8" transform="rotate(-30 29 20)"/>
  <path d="M8 32h48l-6 22a5 5 0 0 1-5 4H19a5 5 0 0 1-5-4z" fill="#d79a52" stroke="#7a4a1c" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M12 41h40M15 50h34M24 33l-2 24M40 33l2 24M32 33v25" stroke="#a8652c" stroke-width="2.5" stroke-linecap="round"/>
  <rect x="6" y="29" width="52" height="7" rx="3.5" fill="#e9b672" stroke="#7a4a1c" stroke-width="3"/>
</svg>`;
}

// A bundle of boosters: a gift box.
export function gift() {
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="28" width="44" height="30" rx="5" fill="#ff5fa2" stroke="#8a1748" stroke-width="3.5"/>
  <rect x="6" y="18" width="52" height="13" rx="5" fill="#ff8fc1" stroke="#8a1748" stroke-width="3.5"/>
  <rect x="27" y="18" width="10" height="40" fill="#ffe14d" stroke="#a35300" stroke-width="3"/>
  <path d="M32 18c-4-12-18-12-16-3 1 5 10 4 16 3zM32 18c4-12 18-12 16-3-1 5-10 4-16 3z" fill="#ffe14d" stroke="#a35300" stroke-width="3" stroke-linejoin="round"/>
  <path d="M14 23h8" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>
</svg>`;
}

// A life refill: a heart with a plus.
export function lifeRefill() {
  return heart().replace('</svg>', '<path d="M32 22v18M23 31h18" stroke="#fff" stroke-width="6.5" stroke-linecap="round"/></svg>');
}

// The prize wheel: eight slices and a pointer.
export function wheelIcon() {
  const colors = ['#ff8fc1', '#ffe14d', '#7fe0f0', '#a6f57e'];
  let slices = '';
  for (let i = 0; i < 8; i++) {
    const a = ((i * 45 - 22.5 - 90) * Math.PI) / 180, b = ((i * 45 + 22.5 - 90) * Math.PI) / 180;
    slices += `<path d="M32 34L${(32 + 24 * Math.cos(a)).toFixed(1)} ${(34 + 24 * Math.sin(a)).toFixed(1)}A24 24 0 0 1 ${(32 + 24 * Math.cos(b)).toFixed(1)} ${(34 + 24 * Math.sin(b)).toFixed(1)}Z" fill="${colors[i % 4]}"/>`;
  }
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="34" r="27" fill="#fff" stroke="#8a1748" stroke-width="3"/>
  ${slices}
  <circle cx="32" cy="34" r="6" fill="#fff" stroke="#8a1748" stroke-width="2.5"/>
  <path d="M32 16l-7-13h14z" fill="#ff4f6a" stroke="#8a1730" stroke-width="2.5" stroke-linejoin="round"/>
</svg>`;
}

export const BOOSTER_ICONS = { smash: mallet, switch: switcher, shuffle: whirl, sweep: sweeper, pick: basket };
export const BOOSTER_NAMES = { smash: 'Smash', switch: 'Switch', shuffle: 'Shuffle', sweep: 'Sweep', pick: 'Picker' };
export const BOOSTER_INFO = {
  smash: 'Knock out any one fruit',
  switch: 'Swap any two fruits, match or not',
  shuffle: 'Mix up the whole board',
  sweep: 'Clear one full row and column',
  pick: 'Take every fruit of one kind',
};
