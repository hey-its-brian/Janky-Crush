// The host: a chibi capybara with a little orange on its head. Poses:
// 'idle', 'cheer' (arms up, happy eyes, open mouth) and 'worried'.
// Returns a standalone SVG (viewBox -14 -12 228 232).

const INK = '#6b3f1c';

export function capy(pose = 'idle') {
  const cheer = pose === 'cheer';
  const worried = pose === 'worried';
  const arms = cheer
    ? `<ellipse cx="24" cy="112" rx="13" ry="24" transform="rotate(-38 24 112)" fill="#b97a46" stroke="${INK}" stroke-width="3"/>` +
      `<ellipse cx="176" cy="112" rx="13" ry="24" transform="rotate(38 176 112)" fill="#b97a46" stroke="${INK}" stroke-width="3"/>`
    : `<ellipse cx="54" cy="156" rx="12" ry="18" transform="rotate(20 54 156)" fill="#b97a46" stroke="${INK}" stroke-width="3"/>` +
      `<ellipse cx="146" cy="156" rx="12" ry="18" transform="rotate(-20 146 156)" fill="#b97a46" stroke="${INK}" stroke-width="3"/>`;
  const eyes = cheer
    ? `<path d="M64 64 Q72 54 80 64" stroke="#1e1208" stroke-width="5" fill="none" stroke-linecap="round"/>` +
      `<path d="M120 64 Q128 54 136 64" stroke="#1e1208" stroke-width="5" fill="none" stroke-linecap="round"/>`
    : worried
      ? `<ellipse cx="72" cy="60" rx="6" ry="7" fill="#1e1208"/><circle cx="74" cy="57" r="2.2" fill="#fff"/>` +
        `<ellipse cx="128" cy="60" rx="6" ry="7" fill="#1e1208"/><circle cx="130" cy="57" r="2.2" fill="#fff"/>`
      // Content, half-closed eyes: the classic chill capybara look.
      : `<ellipse cx="72" cy="61" rx="6.5" ry="6.5" fill="#1e1208"/><circle cx="74" cy="62" r="2" fill="#fff"/>` +
        `<path d="M64 60 Q72 52 80 60 L80 56 Q72 48 64 56Z" fill="#c4864f"/><path d="M64 60 Q72 55 80 60" stroke="#4a2a14" stroke-width="3" fill="none" stroke-linecap="round"/>` +
        `<ellipse cx="128" cy="61" rx="6.5" ry="6.5" fill="#1e1208"/><circle cx="130" cy="62" r="2" fill="#fff"/>` +
        `<path d="M120 60 Q128 52 136 60 L136 56 Q128 48 120 56Z" fill="#c4864f"/><path d="M120 60 Q128 55 136 60" stroke="#4a2a14" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  const brows = worried
    ? `<path d="M62 46 L80 50" stroke="#4a2a14" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M138 46 L120 50" stroke="#4a2a14" stroke-width="4" stroke-linecap="round"/>`
    : '';
  const mouth = cheer
    ? `<path d="M88 96 Q100 94 112 96 Q110 112 100 112 Q90 112 88 96Z" fill="#c2394f" stroke="#4a2a14" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M93 106 Q100 102 107 106 Q104 111 100 111 Q96 111 93 106Z" fill="#ff8fa6"/>`
    : worried
      ? `<path d="M90 104 Q100 98 110 104" stroke="#4a2a14" stroke-width="3" fill="none" stroke-linecap="round"/>`
      : `<path d="M88 96 Q94 103 100 96 Q106 103 112 96" stroke="#4a2a14" stroke-width="3" fill="none" stroke-linecap="round"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-14 -12 228 232">` +
    `<defs><radialGradient id="yz" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffe7a8"/>` +
    `<stop offset=".5" stop-color="#ffb02e"/><stop offset="1" stop-color="#d36a00"/></radialGradient></defs>` +
    `<ellipse cx="100" cy="212" rx="62" ry="8" fill="#3a1a00" opacity=".2"/>` +
    // body, belly, feet
    `<path d="M40 152 C40 112 70 98 100 98 C130 98 160 112 160 152 C160 192 134 208 100 208 C66 208 40 192 40 152Z" fill="#b97a46" stroke="${INK}" stroke-width="3"/>` +
    `<ellipse cx="100" cy="164" rx="34" ry="30" fill="#cf935c"/>` +
    `<ellipse cx="74" cy="206" rx="17" ry="9" fill="#8a5530" stroke="${INK}" stroke-width="3"/>` +
    `<ellipse cx="126" cy="206" rx="17" ry="9" fill="#8a5530" stroke="${INK}" stroke-width="3"/>` +
    arms +
    // head
    `<ellipse cx="58" cy="36" rx="9" ry="7" transform="rotate(-15 58 36)" fill="#8a5530" stroke="${INK}" stroke-width="3"/>` +
    `<ellipse cx="142" cy="36" rx="9" ry="7" transform="rotate(15 142 36)" fill="#8a5530" stroke="${INK}" stroke-width="3"/>` +
    `<path d="M32 62 C32 42 48 32 72 32 L128 32 C152 32 168 42 168 62 L168 86 C168 108 150 120 126 120 L74 120 C50 120 32 108 32 86Z" fill="#c4864f" stroke="${INK}" stroke-width="3"/>` +
    `<path d="M50 88 C50 74 66 68 100 68 C134 68 150 74 150 88 C150 106 132 116 100 116 C68 116 50 106 50 88Z" fill="#d6995f"/>` +
    `<rect x="76" y="70" width="48" height="16" rx="8" fill="#4a2a14"/>` +
    `<ellipse cx="89" cy="78" rx="3.4" ry="2" fill="#8a5530"/><ellipse cx="111" cy="78" rx="3.4" ry="2" fill="#8a5530"/>` +
    mouth + eyes + brows +
    `<ellipse cx="50" cy="80" rx="10" ry="6" fill="#ff8fb0" opacity=".7"/>` +
    `<ellipse cx="150" cy="80" rx="10" ry="6" fill="#ff8fb0" opacity=".7"/>` +
    `<ellipse cx="78" cy="42" rx="14" ry="6" transform="rotate(-20 78 42)" fill="#fff" opacity=".18"/>` +
    // the orange on its head
    `<circle cx="100" cy="24" r="19" fill="url(#yz)" stroke="#9a4100" stroke-width="3"/>` +
    `<path d="M101 6 C109 -4 124 -2 126 4 C118 11 108 11 101 6Z" fill="#4cc94f" stroke="#1d6b22" stroke-width="2"/>` +
    `<ellipse cx="93" cy="16" rx="6" ry="3.5" transform="rotate(-30 93 16)" fill="#fff" opacity=".7"/>` +
    `</svg>`;
}
