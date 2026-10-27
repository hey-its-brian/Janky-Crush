// Small UI icons as SVG strings: coin, heart (lives) and the boosters.
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

export const BOOSTER_ICONS = { smash: mallet, switch: switcher, shuffle: whirl };
export const BOOSTER_NAMES = { smash: 'Smash', switch: 'Switch', shuffle: 'Shuffle' };
export const BOOSTER_INFO = {
  smash: 'Knock out any one fruit',
  switch: 'Swap any two fruits, match or not',
  shuffle: 'Mix up the whole board',
};
