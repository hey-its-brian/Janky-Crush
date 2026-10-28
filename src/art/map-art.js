// Big map scenery and characters for the four zones of the level map. Each
// returns a standalone SVG string. Moving parts carry a class (wave-arm,
// flame, snap, blink, tail) that styles.css animates; transform-box makes
// each one turn around its own anchor.

const wrap = (vb, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${body}</svg>`;
const OUT = 'stroke="#3d1f08" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
const shine = (cx, cy, rx, ry, rot = -30, o = 0.55) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})" fill="#fff" opacity="${o}"/>`;
// Chibi eyes and a smile, shared by the critters.
const eye = (x, y, r = 6) =>
  `<g class="blink" style="transform-origin:${x}px ${y}px"><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.15}" fill="#1e1208"/>` +
  `<circle cx="${x + r * 0.35}" cy="${y - r * 0.4}" r="${r * 0.38}" fill="#fff"/></g>`;
const blush = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="7" ry="4" fill="#ff7fa6" opacity=".55"/>`;
const smile = (x, y, w = 10) => `<path d="M${x - w} ${y} Q${x} ${y + w} ${x + w} ${y}" fill="#b8344d" ${OUT}/>`;
const shadow = (cx, cy, rx) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${rx * 0.22}" fill="#000" opacity=".18"/>`;

// ---- buildings and props ------------------------------------------------------

// A tiki hut on stilts with a thatched roof, viewBox 0 0 160 150.
export function hut(roof = '#e0a84a') {
  const straw = Array.from({ length: 9 }, (_, i) => `<path d="M${18 + i * 15} 62 l-4 18" stroke="#9a6a1c" stroke-width="2.5" stroke-linecap="round"/>`).join('');
  return wrap('0 0 160 150',
    shadow(80, 142, 62) +
    `<rect x="30" y="66" width="100" height="62" rx="6" fill="#c98a4b" ${OUT}/>` +
    `<path d="M30 86 H130 M30 106 H130" stroke="#8a5226" stroke-width="2.5"/>` +
    `<rect x="64" y="90" width="32" height="38" rx="14" fill="#5a3216" ${OUT}/>` +
    `<circle cx="90" cy="110" r="2.5" fill="#ffcf3a"/>` +
    `<rect x="38" y="78" width="18" height="16" rx="3" fill="#9ff3f2" ${OUT}/><rect x="104" y="78" width="18" height="16" rx="3" fill="#9ff3f2" ${OUT}/>` +
    `<path d="M10 74 L80 14 L150 74 Q80 86 10 74Z" fill="${roof}" ${OUT}/>` + straw +
    `<path d="M40 50 L80 18 L120 50" stroke="#fff3c4" stroke-width="3" fill="none" opacity=".6"/>` +
    `<path d="M74 14 l6 -10 l6 10" fill="${roof}" ${OUT}/>` +
    `<rect x="34" y="126" width="8" height="18" fill="#7a4a1c"/><rect x="118" y="126" width="8" height="18" fill="#7a4a1c"/>`);
}

// A round orange tree (citrus, for Yuzu Valley), viewBox 0 0 140 170.
export function orangeTree() {
  const fruit = [[38, 54], [92, 40], [104, 82], [52, 92], [76, 68], [30, 78]]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#ff9a1f" stroke="#c65400" stroke-width="2"/>${shine(x - 3, y - 3, 3, 2)}`).join('');
  return wrap('0 0 140 170',
    shadow(70, 162, 40) +
    `<path d="M62 160 C64 130 60 110 66 100 L76 100 C80 112 76 130 80 160Z" fill="#9a6235" ${OUT}/>` +
    `<path d="M70 8 C110 6 136 30 132 66 C128 100 104 116 70 114 C34 116 8 98 8 64 C8 30 32 8 70 8Z" fill="#4cc94f" ${OUT}/>` +
    `<path d="M30 40 C40 22 60 16 80 18" stroke="#9ef08a" stroke-width="6" fill="none" stroke-linecap="round" opacity=".7"/>` +
    fruit);
}

// A tiki torch with a flickering flame, viewBox 0 0 40 130.
export function torch() {
  return wrap('0 0 40 130',
    `<path d="M16 50 L20 128 L24 50Z" fill="#8a5226" ${OUT}/>` +
    `<path d="M10 36 H30 L26 54 H14Z" fill="#c98a4b" ${OUT}/>` +
    `<path d="M10 42 H30" stroke="#5a3216" stroke-width="2.5"/>` +
    `<g class="flame" style="transform-origin:20px 36px"><path d="M20 2 C30 14 32 24 26 34 Q20 40 14 34 C8 24 12 14 20 2Z" fill="#ff8a1f" stroke="#c65400" stroke-width="2"/>` +
    `<path d="M20 14 C25 22 25 28 22 33 Q20 35 18 33 C15 28 16 22 20 14Z" fill="#ffe14d"/></g>`);
}

// A string of paper lanterns between two posts, viewBox 0 0 220 110.
export function lanterns() {
  const colors = ['#ff5f5f', '#ffcf3a', '#ff7fb8', '#ff9a1f'];
  const lamps = [44, 88, 132, 176].map((x, i) => {
    const y = 34 + Math.sin((i + 0.5) / 4 * Math.PI) * 14;
    return `<g class="swing" style="transform-origin:${x}px ${y - 6}px">` +
      `<line x1="${x}" y1="${y - 6}" x2="${x}" y2="${y}" stroke="#3d1f08" stroke-width="2"/>` +
      `<rect x="${x - 11}" y="${y}" width="22" height="28" rx="10" fill="${colors[i]}" ${OUT}/>` +
      `<path d="M${x - 11} ${y + 9} H${x + 11} M${x - 11} ${y + 19} H${x + 11}" stroke="#3d1f08" stroke-width="1.5" opacity=".5"/>` +
      `<rect x="${x - 6}" y="${y + 28}" width="12" height="4" fill="#3d1f08"/>` +
      `<ellipse cx="${x - 4}" cy="${y + 8}" rx="3" ry="5" fill="#fff" opacity=".5"/></g>`;
  }).join('');
  return wrap('0 0 220 110',
    `<rect x="4" y="18" width="10" height="90" rx="3" fill="#8a5226" ${OUT}/><rect x="206" y="18" width="10" height="90" rx="3" fill="#8a5226" ${OUT}/>` +
    `<path d="M9 22 Q110 62 211 22" stroke="#3d1f08" stroke-width="2.5" fill="none"/>` + lamps);
}

// A cherry-blossom tree, viewBox 0 0 150 170.
export function sakura() {
  const puffs = [[40, 50, 30], [80, 34, 34], [114, 56, 28], [60, 76, 30], [100, 84, 26]]
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffc1dc" ${OUT}/>`).join('');
  const dots = [[30, 40], [70, 24], [108, 46], [56, 70], [92, 76], [124, 66], [44, 62], [84, 50]]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#ff7fb8"/>`).join('');
  return wrap('0 0 150 170',
    shadow(76, 162, 40) +
    `<path d="M68 160 C70 130 62 110 56 96 L68 92 C74 104 80 118 84 160Z M74 110 L100 92" fill="#7a4a2c" ${OUT}/>` +
    puffs + `<path d="M36 46 C30 70 70 100 110 80" fill="none"/>` + dots +
    shine(70, 22, 14, 6, -10, 0.5));
}

// A snowy pine tree, viewBox 0 0 100 150.
export function pine(snow = true) {
  return wrap('0 0 100 150',
    shadow(50, 144, 30) +
    `<rect x="44" y="118" width="12" height="26" fill="#7a4a1c" ${OUT}/>` +
    `<path d="M50 6 L84 56 H66 L92 92 H70 L96 124 H4 L30 92 H8 L34 56 H16Z" fill="#2f8f4a" ${OUT}/>` +
    (snow ? `<path d="M50 6 L64 26 Q50 32 36 26Z M34 56 Q50 64 66 56 L72 64 Q50 72 28 64Z M30 92 Q50 100 70 92 L78 100 Q50 108 22 100Z" fill="#fff"/>` : ''));
}

// Snowy mountains for the far background, viewBox 0 0 440 160.
export function mountains() {
  return wrap('0 0 440 160',
    `<path d="M0 160 L70 50 L120 100 L190 20 L260 110 L320 40 L390 96 L440 60 L440 160Z" fill="#b6a8e6" stroke="#7d6bc4" stroke-width="3" stroke-linejoin="round"/>` +
    `<path d="M70 50 L90 82 L78 78 L64 88 L56 72Z M190 20 L218 62 L200 56 L184 70 L170 50Z M320 40 L344 74 L326 70 L312 80 L302 66Z" fill="#fff"/>` +
    `<path d="M0 160 L40 120 L90 140 L150 100 L220 140 L290 110 L360 140 L440 110 L440 160Z" fill="#cdbff2"/>`);
}

// A big steaming onsen pool, viewBox 0 0 220 110.
export function onsen() {
  const stones = [[14, 60, 14], [36, 82, 15], [70, 94, 14], [110, 98, 15], [150, 94, 14], [184, 82, 15], [206, 60, 14], [196, 34, 11], [24, 34, 11]]
    .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.8}" fill="#c9c2d6" stroke="#6e6680" stroke-width="2.5"/>`).join('');
  return wrap('0 0 220 110',
    `<ellipse cx="110" cy="58" rx="100" ry="40" fill="#5fd8e4" stroke="#2aa7b8" stroke-width="3"/>` +
    `<ellipse cx="90" cy="50" rx="36" ry="7" fill="#fff" opacity=".45"/><ellipse cx="146" cy="66" rx="20" ry="4" fill="#fff" opacity=".35"/>` + stones);
}

// ---- characters (each waves, snaps or wiggles) ----------------------------------

// A red panda waving, viewBox 0 0 120 150.
export function redPanda() {
  return wrap('0 0 124 150',
    shadow(60, 144, 34) +
    `<g class="tail" style="transform-origin:78px 112px"><path d="M78 112 C104 112 116 90 108 70 C120 92 114 124 82 126Z" fill="#d9541c" ${OUT}/>` +
    `<path d="M100 82 l9 3 M104 96 l10 0 M100 110 l9 -4" stroke="#7a2a08" stroke-width="5" stroke-linecap="round"/></g>` +
    `<path d="M36 100 C36 82 84 82 84 100 L86 136 H34Z" fill="#5a2310" ${OUT}/>` +
    `<path d="M40 104 C30 112 30 124 38 128" fill="#5a2310" ${OUT}/>` +
    `<path d="M24 34 L18 12 L40 22Z M96 34 L102 12 L80 22Z" fill="#d9541c" ${OUT}/>` +
    `<path d="M26 26 l-3 -9 l9 5Z M94 26 l3 -9 l-9 5Z" fill="#fff"/>` +
    `<ellipse cx="60" cy="56" rx="42" ry="36" fill="#e2622a" ${OUT}/>` +
    `<path d="M24 60 C30 44 44 44 50 58 C46 70 30 74 24 60Z M96 60 C90 44 76 44 70 58 C74 70 90 74 96 60Z" fill="#fff"/>` +
    `<ellipse cx="60" cy="72" rx="16" ry="11" fill="#fff"/>` +
    eye(42, 56, 5.5) + eye(78, 56, 5.5) +
    `<ellipse cx="60" cy="66" rx="5" ry="3.5" fill="#1e1208"/>` + smile(60, 73, 6) + blush(30, 70) + blush(90, 70) +
    shine(44, 32, 12, 5, -20, 0.35) +
    `<g class="wave-arm" style="transform-origin:82px 104px"><path d="M82 104 C98 96 110 82 112 66" fill="none" stroke="#3d1f08" stroke-width="15" stroke-linecap="round"/>` +
    `<path d="M82 104 C98 96 110 82 112 66" fill="none" stroke="#5a2310" stroke-width="9" stroke-linecap="round"/>` +
    `<circle cx="112" cy="64" r="7" fill="#5a2310" stroke="#3d1f08" stroke-width="3"/></g>`);
}

// A sea turtle waving a flipper, viewBox 0 0 140 110.
export function turtle() {
  const hexes = [[56, 54], [76, 46], [96, 54], [66, 70], [88, 70]]
    .map(([x, y]) => `<path d="M${x - 8} ${y} l4 -7 h8 l4 7 l-4 7 h-8Z" fill="#5fbf4a" stroke="#2a6b1c" stroke-width="2"/>`).join('');
  return wrap('0 0 140 110',
    shadow(74, 102, 50) +
    `<path d="M40 86 L28 98 L48 96Z M104 86 L118 98 L98 96Z" fill="#9fd88a" ${OUT}/>` +
    `<path d="M34 76 C34 40 116 40 116 76 C116 90 34 90 34 76Z" fill="#3f9f3a" ${OUT}/>` + hexes +
    `<g class="wave-arm" style="transform-origin:40px 72px"><path d="M40 72 C26 66 14 52 16 40 C26 46 36 58 44 66Z" fill="#9fd88a" ${OUT}/></g>` +
    `<circle cx="22" cy="74" r="18" fill="#a8e28e" ${OUT}/>` +
    eye(15, 70, 4) + eye(28, 70, 4) + smile(21, 79, 5) + blush(11, 80));
}

// A crab snapping its claws, viewBox 0 0 120 90.
export function crab() {
  const claw = (x, flip) => `<g class="snap" style="transform-origin:${x}px 50px"><path d="M${x} 50 C${x + flip * 4} 30 ${x + flip * 16} 18 ${x + flip * 22} 26 C${x + flip * 14} 28 ${x + flip * 12} 36 ${x + flip * 20} 40 C${x + flip * 12} 48 ${x + flip * 4} 52 ${x} 50Z" fill="#ff4f4f" ${OUT}/></g>`;
  return wrap('0 0 120 90',
    shadow(60, 84, 36) +
    `<path d="M34 66 l-14 12 M40 70 l-10 14 M86 66 l14 12 M80 70 l10 14" stroke="#3d1f08" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M34 66 l-14 12 M40 70 l-10 14 M86 66 l14 12 M80 70 l10 14" stroke="#ff4f4f" stroke-width="3" stroke-linecap="round"/>` +
    claw(26, -1) + claw(94, 1) +
    `<ellipse cx="60" cy="60" rx="32" ry="20" fill="#ff5f4f" ${OUT}/>` +
    `<path d="M50 42 v-10 M70 42 v-10" stroke="#3d1f08" stroke-width="3"/>` +
    eye(50, 30, 5) + eye(70, 30, 5) + smile(60, 62, 7) + shine(48, 52, 9, 4, -15, 0.45));
}

// A frog holding a lantern, viewBox 0 0 120 130.
export function frog() {
  return wrap('0 0 120 130',
    shadow(58, 124, 36) +
    `<path d="M30 118 C24 90 30 76 58 76 C86 76 92 90 86 118Z" fill="#5fcf4a" ${OUT}/>` +
    `<ellipse cx="58" cy="104" rx="18" ry="12" fill="#d8f7b0"/>` +
    `<g class="wave-arm" style="transform-origin:86px 92px"><path d="M86 92 C98 84 104 72 102 60" stroke="#3d1f08" stroke-width="13" fill="none" stroke-linecap="round"/>` +
    `<path d="M86 92 C98 84 104 72 102 60" stroke="#5fcf4a" stroke-width="7" fill="none" stroke-linecap="round"/>` +
    `<line x1="102" y1="58" x2="102" y2="40" stroke="#3d1f08" stroke-width="2"/>` +
    `<rect x="93" y="22" width="18" height="20" rx="7" fill="#ff5f5f" ${OUT}/><ellipse cx="99" cy="28" rx="2.5" ry="4" fill="#fff" opacity=".6"/></g>` +
    `<ellipse cx="58" cy="58" rx="40" ry="28" fill="#6fdc56" ${OUT}/>` +
    `<circle cx="36" cy="36" r="15" fill="#6fdc56" ${OUT}/><circle cx="80" cy="36" r="15" fill="#6fdc56" ${OUT}/>` +
    `<circle cx="36" cy="36" r="9" fill="#fff"/><circle cx="80" cy="36" r="9" fill="#fff"/>` +
    eye(37, 37, 5) + eye(81, 37, 5) +
    `<path d="M34 64 Q58 82 82 64" stroke="#3d1f08" stroke-width="3.5" fill="#b8344d" stroke-linejoin="round"/>` + blush(26, 60) + blush(90, 60));
}

// A snow monkey soaking with a towel on its head, viewBox 0 0 140 110.
export function snowMonkey() {
  return wrap('0 0 140 110',
    `<ellipse cx="70" cy="86" rx="64" ry="20" fill="#5fd8e4" stroke="#2aa7b8" stroke-width="3"/>` +
    `<g class="wave-arm" style="transform-origin:100px 76px"><path d="M100 76 C112 66 116 52 112 42" stroke="#3d1f08" stroke-width="15" fill="none" stroke-linecap="round"/>` +
    `<path d="M100 76 C112 66 116 52 112 42" stroke="#c9c2d6" stroke-width="9" fill="none" stroke-linecap="round"/></g>` +
    `<path d="M40 82 C40 60 100 60 100 82Z" fill="#c9c2d6" ${OUT}/>` +
    `<circle cx="70" cy="44" r="30" fill="#d8d2e2" ${OUT}/>` +
    `<path d="M48 46 C48 32 92 32 92 46 C92 62 80 68 70 68 C60 68 48 62 48 46Z" fill="#ff9aa8" ${OUT}/>` +
    eye(61, 48, 4.5) + eye(79, 48, 4.5) + smile(70, 58, 6) +
    `<path d="M44 22 C52 8 90 8 96 22 L90 28 C82 20 58 20 50 28Z" fill="#fff" ${OUT}/>` +
    `<path d="M56 16 h28" stroke="#7ad0f0" stroke-width="3"/>` +
    `<ellipse cx="40" cy="90" rx="10" ry="3" fill="#fff" opacity=".5"/><ellipse cx="104" cy="94" rx="8" ry="2.5" fill="#fff" opacity=".5"/>`);
}

// A toucan on a branch, viewBox 0 0 120 110.
export function toucan() {
  return wrap('0 0 120 110',
    `<path d="M4 96 C40 90 80 92 116 88" stroke="#7a4a1c" stroke-width="8" stroke-linecap="round" fill="none"/>` +
    `<path d="M40 92 C30 70 34 46 52 40 C72 34 82 54 76 78 C72 92 56 98 40 92Z" fill="#2a2a3a" ${OUT}/>` +
    `<path d="M52 50 C46 60 48 72 56 76 C64 70 64 58 60 50Z" fill="#fff6c8"/>` +
    `<g class="snap" style="transform-origin:66px 42px"><path d="M64 36 C80 28 104 30 112 40 C100 46 80 48 66 48Z" fill="#ff9a1f" ${OUT}/>` +
    `<path d="M104 34 C110 36 112 40 112 40 C106 42 102 42 100 42Z" fill="#2a2a3a"/>` +
    `<path d="M66 42 C80 40 96 40 110 40" stroke="#c65400" stroke-width="2"/></g>` +
    `<circle cx="56" cy="38" r="8" fill="#9ff3f2" stroke="#3d1f08" stroke-width="2"/>` + eye(57, 38, 3.5) +
    `<path d="M48 92 l-4 8 M58 94 l2 8" stroke="#ff9a1f" stroke-width="4" stroke-linecap="round"/>`);
}
