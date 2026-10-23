// The level map: a winding sandy path up through a tropical valley, with
// hot-spring pools, palms, flowers, critters, a drifting balloon, and the
// capybara host standing at your next level. Decorations are placed by a
// seeded random so the map looks the same every time. All the markup is
// built from our own art and level data, never user input.

import { palm, cloud, pool, steam, flower, bush, butterfly, balloon, rocks, bird } from '../art/scene.js';
import { ducky, pup } from '../art/pieces.js';
import { capy } from '../art/capy.js';
import { makeRng } from '../rng.js';

const SPACING = 112;
const TOP = 300;     // room above the last level
const BOTTOM = 190;  // room below level 1 (the Play button sits here)
const ZONES = [
  { from: 1, name: 'Yuzu Valley' },
  { from: 11, name: 'Steamy Springs' },
  { from: 21, name: 'Duck Pond Peaks' },
];

const sprite = (svg, style, cls = '') => `<div class="sprite ${cls}" style="${style}">${svg}</div>`;

// Points along the path: level i (0-based) and the curve between them.
function layout(n, width) {
  const height = TOP + (n - 1) * SPACING + BOTTOM;
  const swing = Math.min(130, width / 2 - 64);
  const nodes = Array.from({ length: n }, (_, i) => ({
    x: width / 2 + Math.sin(i * 0.9 + 0.4) * swing,
    y: height - BOTTOM - i * SPACING,
  }));
  // Sample the curve so decorations can stay off the path.
  const samples = [];
  for (let i = 1; i < n; i++) {
    const a = nodes[i - 1], b = nodes[i], my = (a.y + b.y) / 2;
    for (let t = 0; t <= 1; t += 0.1) {
      const u = 1 - t;
      samples.push({
        x: u * u * u * a.x + 3 * u * u * t * a.x + 3 * u * t * t * b.x + t * t * t * b.x,
        y: u * u * u * a.y + 3 * u * u * t * my + 3 * u * t * t * my + t * t * t * b.y,
      });
    }
  }
  let d = `M ${nodes[0].x} ${height + 40} L ${nodes[0].x} ${nodes[0].y}`;
  for (let i = 1; i < n; i++) {
    const a = nodes[i - 1], b = nodes[i], my = (a.y + b.y) / 2;
    d += ` C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`;
  }
  d += ` L ${nodes[n - 1].x} ${nodes[n - 1].y - 140}`;
  return { height, nodes, samples, d };
}

function decorations(width, height, samples, nodes) {
  const rng = makeRng(20261024);
  const out = [];
  const clear = (x, y, r) => samples.every((p) => Math.hypot(p.x - x, p.y - y) > r) &&
    nodes.every((p) => Math.hypot(p.x - x, p.y - y) > r + 20);
  const place = (w, h, y0, y1, pad, make) => {
    for (let tries = 0; tries < 40; tries++) {
      const x = 8 + rng() * (width - w - 16);
      const y = y0 + rng() * (y1 - y0);
      if (clear(x + w / 2, y + h / 2, pad)) return out.push(make(x, y));
    }
  };
  // One band of scenery per level.
  for (let i = 0; i < nodes.length; i++) {
    const y0 = nodes[i].y - SPACING / 2, y1 = nodes[i].y + SPACING / 2;
    const pick = rng();
    if (i % 4 === 1) {
      // A steaming pool with a duck or a pup in it.
      place(150, 70, y0, y1, 95, (x, y) =>
        sprite(pool(), `left:${x}px;top:${y}px;width:150px;height:70px`) +
        sprite(steam(), `left:${x + 40}px;top:${y - 30}px;animation-delay:-${(i * 0.7) % 4}s`, 'steam') +
        sprite(steam(), `left:${x + 90}px;top:${y - 26}px;animation-delay:-${(i * 1.3) % 4}s`, 'steam') +
        sprite(i % 8 === 1 ? ducky() : pup(), `left:${x + 50}px;top:${y + 8}px;width:40px;height:40px`, 'bob'));
    } else if (pick < 0.45) {
      place(110, 220, y0 - 120, y1 - 120, 70, (x, y) =>
        sprite(palm(rng() < 0.5), `left:${x}px;top:${y}px;width:110px;height:220px`, rng() < 0.5 ? 'sway' : 'sway b'));
    } else {
      place(100, 50, y0, y1, 60, (x, y) => sprite(bush(), `left:${x}px;top:${y}px;width:100px;height:50px`));
    }
    place(60, 34, y0, y1, 50, (x, y) => sprite(rocks(), `left:${x}px;top:${y}px;width:60px;height:34px`));
    for (let f = 0; f < 3; f++) {
      const c = ['#ff6fae', '#ffb02e', '#9b4dff', '#ffffff'][Math.floor(rng() * 4)];
      place(24, 24, y0, y1, 40, (x, y) => sprite(flower(c), `left:${x}px;top:${y}px;width:24px;height:24px`));
    }
    for (let g = 0; g < 4; g++) place(34, 14, y0, y1, 34, (x, y) => `<div class="tuft" style="left:${x}px;top:${y}px"></div>`);
  }
  // Things in the air.
  for (let i = 0; i < nodes.length; i += 5) {
    const y = nodes[i].y - 60;
    out.push(sprite(butterfly(['#8b5cf6', '#ff6fae', '#2ec4d6'][i % 3]), `left:${20 + ((i * 53) % (width - 80))}px;top:${y}px;width:30px;height:22px;animation-delay:-${i}s`, 'flutter'));
  }
  for (let i = 3; i < nodes.length; i += 9) {
    out.push(sprite(bird(), `left:-40px;top:${nodes[i].y - 40}px;width:30px;height:14px;animation-delay:-${i}s`, 'fly'));
    out.push(sprite(bird(), `left:-70px;top:${nodes[i].y - 20}px;width:24px;height:11px;animation-delay:-${i + 0.4}s`, 'fly'));
  }
  out.push(sprite(balloon(), `left:${width * 0.6}px;top:${nodes[Math.min(6, nodes.length - 1)].y - 80}px;width:64px;height:88px`, 'float'));
  out.push(sprite(balloon(), `left:${width * 0.12}px;top:${nodes[Math.min(17, nodes.length - 1)].y - 60}px;width:54px;height:74px;animation-delay:-5s`, 'float'));
  for (let i = 0; i < 5; i++) {
    out.push(sprite(cloud(), `left:${(i * 131) % width}px;top:${30 + i * 50}px;width:${120 - i * 10}px;height:${60 - i * 5}px;animation-delay:-${i * 9}s`, 'cloud slow'));
  }
  return out.join('');
}

// Draws the map into `el`. `progress` is a save.js Progress; `onPick(level)`
// is called when an unlocked level is tapped. Returns the current level.
export function renderMap(el, levels, progress, onPick) {
  const width = el.clientWidth || window.innerWidth;
  const { height, nodes, samples, d } = layout(levels.length, width);
  const unlocked = Math.min(progress.unlocked(), levels.length);
  const current = levels[unlocked - 1];

  const path = `<svg class="map-path" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">
    <path d="${d}" stroke="#c98a4b" stroke-width="60" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" stroke="#ffe0a3" stroke-width="48" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" stroke="#fff4d6" stroke-width="6" fill="none" stroke-dasharray="2 18" stroke-linecap="round"/>
  </svg>`;

  const signs = ZONES.filter((z) => z.from <= levels.length).map((z) => {
    const p = nodes[z.from - 1];
    const left = p.x > width / 2 ? Math.max(8, p.x - 210) : Math.min(width - 160, p.x + 60);
    return `<div class="sign" style="left:${left}px;top:${p.y - 70}px">${z.name}</div>`;
  }).join('');
  const top = nodes[nodes.length - 1];
  const soon = `<div class="sign soon" style="left:${Math.max(8, top.x - 90)}px;top:${top.y - 190}px">More levels soon!</div>`;

  el.style.height = `${height}px`;
  el.innerHTML = path + decorations(width, height, samples, nodes) + signs + soon;

  levels.forEach((level, i) => {
    const p = nodes[i];
    const best = progress.level(level.id);
    const locked = level.id > unlocked;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `node ${locked ? 'locked' : level.goal.type}${level.id === unlocked ? ' current' : ''}`;
    btn.style.cssText = `left:${p.x}px;top:${p.y}px`;
    btn.setAttribute('aria-label', locked ? `Level ${level.id}, locked` : `Level ${level.id}, ${best.stars} stars`);
    if (locked) {
      btn.setAttribute('aria-disabled', 'true');
      btn.innerHTML = '<i class="lock" aria-hidden="true"></i>';
    } else {
      const num = document.createElement('b');
      num.textContent = String(level.id);
      btn.append(num);
      btn.addEventListener('click', () => onPick(level));
    }
    el.append(btn);
    if (!locked) {
      const stars = document.createElement('div');
      stars.className = 'node-stars';
      stars.style.cssText = `left:${p.x}px;top:${p.y - 34}px`;
      stars.setAttribute('aria-hidden', 'true');
      for (let s = 0; s < 3; s++) {
        const star = document.createElement('i');
        if (s >= best.stars) star.className = 'off';
        stars.append(star);
      }
      el.append(stars);
    }
  });

  // The host waits beside the next level to play.
  const cur = nodes[unlocked - 1];
  const side = cur.x > width / 2 ? -1 : 1;
  const host = document.createElement('div');
  host.className = 'sprite map-host';
  host.style.cssText = `left:${cur.x + side * 46 - 48}px;top:${cur.y - 104}px;width:96px;height:100px`;
  host.innerHTML = capy('cheer');
  el.append(host);

  return { current, y: cur.y };
}
