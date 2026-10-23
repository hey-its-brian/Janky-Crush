// The host: a chibi capybara with a little orange on its head. Big round
// head, tiny body, stubby limbs, glossy eyes, soft shading. Poses: 'idle'
// (content, half-lidded), 'cheer' (arms up, happy eyes, open mouth) and
// 'worried'. Returns a standalone SVG (viewBox 0 0 220 224).

const LINE = '#8a5530';

let n = 0;

export function capy(pose = 'idle') {
  const u = `c${++n}`;
  const cheer = pose === 'cheer';
  const worried = pose === 'worried';

  const defs =
    `<radialGradient id="${u}h" cx=".38" cy=".3" r=".78"><stop offset="0" stop-color="#ecb67d"/><stop offset=".55" stop-color="#c98a52"/><stop offset="1" stop-color="#9a6235"/></radialGradient>` +
    `<radialGradient id="${u}b" cx=".4" cy=".25" r=".85"><stop offset="0" stop-color="#e2a96f"/><stop offset=".6" stop-color="#bf7f48"/><stop offset="1" stop-color="#8f5a2f"/></radialGradient>` +
    `<radialGradient id="${u}s" cx=".45" cy=".25" r=".8"><stop offset="0" stop-color="#f7d3a4"/><stop offset=".65" stop-color="#e0aa73"/><stop offset="1" stop-color="#c48a55"/></radialGradient>` +
    `<linearGradient id="${u}n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a4523"/><stop offset="1" stop-color="#3d1f0c"/></linearGradient>` +
    `<radialGradient id="${u}k" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff8fae" stop-opacity=".85"/><stop offset="1" stop-color="#ff8fae" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="${u}e" cx=".5" cy=".35" r=".65"><stop offset="0" stop-color="#5a3216"/><stop offset=".7" stop-color="#2a1408"/><stop offset="1" stop-color="#150903"/></radialGradient>` +
    `<radialGradient id="${u}y" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff0b8"/><stop offset=".5" stop-color="#ffb02e"/><stop offset="1" stop-color="#d86a00"/></radialGradient>` +
    `<filter id="${u}f" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter>`;

  // Big glossy eye. `lid` makes it the chill, half-closed capybara look:
  // the eye is drawn as its lower part under a soft lid line.
  const eye = (x, lid) => {
    if (!lid) {
      return `<ellipse cx="${x}" cy="86" rx="11" ry="13" fill="url(#${u}e)"/>` +
        `<circle cx="${x + 4}" cy="80" r="4.2" fill="#fff"/><circle cx="${x - 4}" cy="92" r="2" fill="#fff" opacity=".9"/>`;
    }
    const dx = 10.4; // half-width of the eye where the lid cuts it (y = 82)
    return `<path d="M${x - dx} 82 Q${x} 77 ${x + dx} 82 A11 13 0 1 1 ${x - dx} 82Z" fill="url(#${u}e)"/>` +
      `<circle cx="${x + 4}" cy="86" r="3.6" fill="#fff"/><circle cx="${x - 4}" cy="93" r="1.8" fill="#fff" opacity=".9"/>` +
      `<path d="M${x - 13} 82.5 Q${x} 75 ${x + 13} 82.5" stroke="#5a3216" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
  };
  const happyEye = (x) => `<path d="M${x - 11} 88 Q${x} 74 ${x + 11} 88" stroke="#3d1f0c" stroke-width="5.5" fill="none" stroke-linecap="round"/>`;

  const eyes = cheer ? happyEye(72) + happyEye(148) : eye(72, !worried) + eye(148, !worried);
  const brows = worried
    ? `<path d="M58 64 Q66 60 80 66" stroke="#6b3b1d" stroke-width="4" fill="none" stroke-linecap="round"/>` +
      `<path d="M162 64 Q154 60 140 66" stroke="#6b3b1d" stroke-width="4" fill="none" stroke-linecap="round"/>` +
      `<path d="M182 60 C186 68 188 74 184 78 C180 80 176 76 178 70Z" fill="#9fe0ff" stroke="#4aa8d8" stroke-width="1.5"/>`
    : '';
  const mouth = cheer
    ? `<path d="M98 122 Q110 119 122 122 Q120 138 110 138 Q100 138 98 122Z" fill="#b8344d" stroke="#5a2a10" stroke-width="2.5" stroke-linejoin="round"/>` +
      `<path d="M103 132 Q110 128 117 132 Q114 137 110 137 Q106 137 103 132Z" fill="#ff8fa6"/>`
    : worried
      ? `<path d="M100 128 Q105 124 110 128 Q115 132 120 128" stroke="#5a2a10" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
      : `<path d="M100 122 Q105 128 110 122 Q115 128 120 122" stroke="#5a2a10" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;

  const arm = (x, y, rot) =>
    `<ellipse cx="${x}" cy="${y}" rx="10" ry="15" transform="rotate(${rot} ${x} ${y})" fill="url(#${u}b)" stroke="${LINE}" stroke-width="2"/>` +
    `<ellipse cx="${x}" cy="${y - 6}" rx="4" ry="5" transform="rotate(${rot} ${x} ${y})" fill="#fff" opacity=".18"/>`;
  const armsDown = arm(74, 172, 28) + arm(146, 172, -28);
  const armsUp = arm(30, 132, -42) + arm(190, 132, 42);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 224"><defs>${defs}</defs>` +
    // soft shadow on the ground
    `<ellipse cx="110" cy="214" rx="56" ry="8" fill="#3a1a00" opacity=".28" filter="url(#${u}f)"/>` +
    // tiny body, feet, belly
    `<path d="M68 172 C68 146 86 136 110 136 C134 136 152 146 152 172 C152 198 134 210 110 210 C86 210 68 198 68 172Z" fill="url(#${u}b)" stroke="${LINE}" stroke-width="2.5"/>` +
    `<ellipse cx="110" cy="178" rx="24" ry="22" fill="#e6b37e" opacity=".75"/>` +
    `<ellipse cx="92" cy="208" rx="13" ry="7" fill="#9a6235" stroke="${LINE}" stroke-width="2"/>` +
    `<ellipse cx="128" cy="208" rx="13" ry="7" fill="#9a6235" stroke="${LINE}" stroke-width="2"/>` +
    (cheer ? '' : armsDown) +
    // ears, then the big round head
    `<ellipse cx="60" cy="38" rx="11" ry="9" transform="rotate(-20 60 38)" fill="url(#${u}b)" stroke="${LINE}" stroke-width="2"/>` +
    `<ellipse cx="61" cy="39" rx="5" ry="4" transform="rotate(-20 61 39)" fill="#d98a7a" opacity=".7"/>` +
    `<ellipse cx="160" cy="38" rx="11" ry="9" transform="rotate(20 160 38)" fill="url(#${u}b)" stroke="${LINE}" stroke-width="2"/>` +
    `<ellipse cx="159" cy="39" rx="5" ry="4" transform="rotate(20 159 39)" fill="#d98a7a" opacity=".7"/>` +
    `<path d="M26 92 C26 48 60 26 110 26 C160 26 194 48 194 92 C194 134 162 156 110 156 C58 156 26 134 26 92Z" fill="url(#${u}h)" stroke="${LINE}" stroke-width="2.5"/>` +
    // rim light on the top of the head
    `<path d="M48 62 C60 42 84 34 110 34" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" opacity=".28"/>` +
    // the big soft snout and wide nose
    `<ellipse cx="110" cy="118" rx="54" ry="32" fill="url(#${u}s)"/>` +
    `<rect x="86" y="98" width="48" height="18" rx="9" fill="url(#${u}n)"/>` +
    `<ellipse cx="102" cy="102" rx="9" ry="3" fill="#fff" opacity=".35"/>` +
    `<path d="M96 108 q4 -2 6 1 M124 108 q-4 -2 -6 1" stroke="#c48a55" stroke-width="2" fill="none" stroke-linecap="round"/>` +
    mouth + eyes + brows +
    `<ellipse cx="54" cy="110" rx="15" ry="9" fill="url(#${u}k)"/>` +
    `<ellipse cx="166" cy="110" rx="15" ry="9" fill="url(#${u}k)"/>` +
    (cheer ? armsUp : '') +
    // the orange on its head
    `<circle cx="110" cy="24" r="19" fill="url(#${u}y)" stroke="#b05800" stroke-width="2"/>` +
    `<path d="M111 7 C119 -3 134 -1 136 5 C128 12 118 12 111 7Z" fill="#5fd35a" stroke="#2a8a2a" stroke-width="1.8"/>` +
    `<ellipse cx="103" cy="16" rx="6" ry="3.5" transform="rotate(-30 103 16)" fill="#fff" opacity=".75"/>` +
    `</svg>`;
}
