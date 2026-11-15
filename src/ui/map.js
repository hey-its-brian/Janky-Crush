// The level map: a wide sandy road winding up through the zones, ten
// levels each, every zone with its own ground, scenery and waving
// characters. A candy-striped rope runs from level to level; finished
// levels show their stars, the next one glows with the host's portrait
// beside it, and locked ones wait as plain pink stepping stones.
//
// Decorations are placed by a seeded random so the map looks the same every
// time. All the markup is built from our own art and level data, never user
// input.

import { butterfly, bird, steam } from '../art/scene.js';
import { art } from '../art/map-art.js';
import { capy } from '../art/capy.js';
import { makeRng } from '../rng.js';

const SPACING = 120;
const GATE_GAP = 130; // extra room below each zone's first level for its gate
const TOP = 360;     // room above the last level
const BOTTOM = 200;  // room below level 1 (the Play button sits here)

// Each zone: name, ground colors (top, bottom), big props, small props, the
// characters that live there and its flower colors. All are sprite names
// for art().
const ZONES = [
  {
    from: 1, name: 'Yuzu Valley', ground: ['#7fd65a', '#5fc443'],
    props: ['hut', 'yuzutree', 'palm', 'palm:flip', 'yuzutree'], small: ['torch'],
    critters: ['redpanda', 'toucan'], flowers: ['pink', 'orange', 'white'],
  },
  {
    from: 11, name: 'Coconut Cove', ground: ['#ffe7a3', '#f6d283'], sea: true,
    props: ['palm', 'palm:flip', 'beachhut', 'palm'], small: ['torch'],
    critters: ['turtle', 'crab'], flowers: ['orange', 'white'],
  },
  {
    from: 21, name: 'Lantern Hills', ground: ['#b5e08a', '#8fd06a'],
    props: ['sakura', 'sakura', 'teahouse'], small: ['lantern', 'torch'],
    critters: ['frog'], flowers: ['pink', 'white', 'orange'], petals: true,
  },
  {
    from: 31, name: 'Steam Peaks', ground: ['#eaf0ff', '#cfdcf7'], snowy: true,
    props: ['pine', 'pine', 'onsen'], small: ['pine'],
    critters: ['monkey'], flowers: ['white', 'blue'],
  },
  {
    from: 41, name: 'Bamboo Falls', ground: ['#74d39a', '#4fbf7e'],
    props: ['bamboo', 'bamboo', 'waterfall', 'bamboo'], small: ['lantern', 'torch'],
    critters: ['panda'], flowers: ['white', 'pink'],
  },
  {
    from: 51, name: 'Firefly Grove', ground: ['#4a5fa8', '#34478a'], night: true,
    props: ['lanterntree', 'mushrooms', 'lanterntree', 'mushrooms'], small: ['fireflyjar'],
    critters: ['owl'], flowers: ['blue', 'white'],
  },
  {
    from: 61, name: 'Berry Bog', ground: ['#f6c9d8', '#eeaac4'],
    props: ['berrybush', 'berrybush', 'jamcottage', 'berrybush'], small: ['reeds'],
    critters: ['hedgehog'], flowers: ['pink', 'white', 'blue'],
  },
  {
    from: 71, name: 'Festival Pier', ground: ['#5a3d8f', '#432a73'], night: true,
    props: ['stall', 'lanternpole', 'stall', 'lanternpole'], small: ['rockets'],
    critters: ['fox'], flowers: ['orange', 'white'],
  },
  {
    from: 81, name: 'Mill Stream', ground: ['#a8e07a', '#86cf5e'],
    props: ['willow', 'watermill', 'willow', 'willow'], small: ['sacks'],
    critters: ['otter'], flowers: ['white', 'orange', 'pink'],
  },
  {
    from: 91, name: 'Crystal Cavern', ground: ['#6b5aa8', '#4f418a'], night: true,
    props: ['crystals', 'cavehut', 'crystals', 'crystals'], small: ['mushrooms'],
    critters: ['mole'], flowers: ['blue', 'pink'],
  },
];
// Trees sway a little; buildings do not.
const TREES = ['yuzutree', 'palm', 'palm:flip', 'sakura', 'pine', 'bamboo', 'lanterntree', 'berrybush', 'willow', 'crystals'];
// Width and height of the small props, in px.
const SMALL = { torch: [26, 100], lantern: [62, 104], pine: [44, 62], fireflyjar: [40, 66], reeds: [48, 62], rockets: [48, 58], sacks: [52, 46], mushrooms: [46, 50] };

const zoneOf = (id) => [...ZONES].reverse().find((z) => id >= z.from);
// Which zone (1-based) a level is in.
export const zoneNumber = (id) => ZONES.indexOf(zoneOf(id)) + 1;
const sprite = (art, style, cls = '') => `<div class="sprite ${cls}" style="${style}">${art}</div>`;

// Points along the road: level i (0-based) and the curve between them.
function layout(n, width) {
  const gatesBelow = (i) => ZONES.filter((z) => z.from <= i + 1).length;
  const height = TOP + (n - 1) * SPACING + gatesBelow(n - 1) * GATE_GAP + BOTTOM;
  const swing = Math.min(120, width / 2 - 70);
  const nodes = Array.from({ length: n }, (_, i) => ({
    x: width / 2 + Math.sin(i * 0.85 + 0.4) * swing,
    y: height - BOTTOM - i * SPACING - gatesBelow(i) * GATE_GAP,
  }));
  const samples = [];
  for (let i = 1; i < n; i++) {
    const a = nodes[i - 1], b = nodes[i], my = (a.y + b.y) / 2;
    for (let t = 0; t <= 1; t += 0.05) {
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
  const road = `${d} L ${nodes[n - 1].x} ${nodes[n - 1].y - 200}`;
  // The striped rope only links the levels.
  const rope = d.replace(/^M [^ ]+ [^ ]+ L /, 'M ');
  return { height, nodes, samples, road, rope };
}

// Where the road crosses height y.
function roadX(samples, y) {
  let best = samples[0];
  for (const p of samples) if (Math.abs(p.y - y) < Math.abs(best.y - y)) best = p;
  return best.x;
}

// The sea along the left side of a zone: water with a wavy edge, a line of
// foam that washes in and out, and a band of wet sand.
function sea(top, height) {
  const edge = (base, amp, phase) => {
    let d = `M0 0 L${base} 0`;
    for (let y = 0; y <= height; y += 8) d += ` L${(base + amp * Math.sin(y / 34 + phase) + amp * 0.4 * Math.sin(y / 13 + phase * 2)).toFixed(1)} ${y}`;
    return `${d} L0 ${height} Z`;
  };
  let glints = '';
  for (let y = 30, k = 0; y < height - 20; y += 46, k++) {
    const x = 10 + ((k * 23) % 34);
    glints += `<path d="M${x} ${y} q7 -5 14 0" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".55"/>`;
  }
  return `<svg class="sea" style="top:${top}px;height:${height}px" width="100" height="${height}" viewBox="0 0 100 ${height}" aria-hidden="true">
    <defs><linearGradient id="sea-water" x1="0" x2="1"><stop offset="0" stop-color="#1596b4"/><stop offset=".6" stop-color="#35c6d6"/><stop offset="1" stop-color="#8ff0ee"/></linearGradient></defs>
    <path d="${edge(84, 7, 0.4)}" fill="#d9ad62" opacity=".55"/>
    <path class="sea-foam" d="${edge(76, 7, 0)}" fill="#fff"/>
    <path d="${edge(70, 7, 0)}" fill="url(#sea-water)"/>${glints}
  </svg>`;
}

// The ground: each zone's colors, blending into the next, under a sky.
function groundGradient(levels, nodes, height) {
  const stops = [];
  const sky = Math.max(0, nodes[nodes.length - 1].y - 230);
  // A night sky over the map when its last zone is a night zone.
  const night = zoneOf(levels.length).night;
  stops.push(`${night ? '#161c47' : '#9fe2ff'} 0px`, `${night ? '#2c3a78' : '#cdf1ff'} ${sky}px`);
  for (const z of [...ZONES].reverse()) {
    const first = nodes[z.from - 1];
    if (!first) continue;
    const lastId = Math.min(levels.length, (ZONES[ZONES.indexOf(z) + 1]?.from ?? Infinity) - 1);
    const top = nodes[lastId - 1].y - SPACING / 2;
    stops.push(`${z.ground[0]} ${Math.max(sky + 60, top)}px`, `${z.ground[1]} ${first.y + SPACING / 2 - 40}px`);
  }
  stops.push(`${ZONES[0].ground[1]} ${height}px`);
  return `linear-gradient(${stops.join(', ')})`;
}

function decorations(levels, width, height, samples, nodes) {
  const rng = makeRng(20261028);
  const out = [];
  const taken = []; // boxes of the big things, so they don't pile up
  const clear = (x, y, r) => samples.every((p) => Math.hypot(p.x - x, p.y - y) > r) &&
    nodes.every((p) => Math.hypot(p.x - x, p.y - y) > r + 24);
  const free = (x, y, w, h) => taken.every((b) => x + w * 0.85 < b.x || b.x + b.w * 0.85 < x || y + h * 0.85 < b.y || b.y + b.h * 0.85 < y);
  const place = (w, h, y0, y1, pad, make, side = null, big = w >= 60) => {
    for (let tries = 0; tries < 50; tries++) {
      let x = 4 + rng() * (width - w - 8);
      if (side === 'left') x = 4 + rng() * Math.max(1, width / 2 - w);
      if (side === 'right') x = width / 2 + rng() * Math.max(1, width / 2 - w - 4);
      const y = y0 + rng() * (y1 - y0);
      if (!clear(x + w / 2, y + h * 0.75, Math.max(w, h) * 0.45 + 30)) continue;
      if (big && !free(x, y, w, h)) continue;
      if (big) taken.push({ x, y, w, h });
      return out.push(make(x, y));
    }
    return 0;
  };

  for (let i = 0; i < nodes.length; i++) {
    const z = zoneOf(i + 1);
    const p = nodes[i];
    const y0 = p.y - SPACING / 2, y1 = p.y + SPACING / 2;
    const free = p.x > width / 2 ? 'left' : 'right';
    // A big prop each level, on the side away from the road.
    const prop = z.props[Math.floor(rng() * z.props.length)];
    place(130, 140, y0 - 90, y1 - 70, 0, (x, y) => sprite(art(prop), `left:${x}px;top:${y}px;width:130px;height:140px`, TREES.includes(prop) ? 'prop sway-soft' : 'prop'), free);
    // A character every few levels.
    if (i % 3 === 1) {
      const critter = z.critters[(i / 3 | 0) % z.critters.length];
      place(100, 110, y0 - 40, y1 - 50, 0, (x, y) => sprite(art(critter), `left:${x}px;top:${y}px;width:100px;height:110px;animation-delay:-${(i * 0.37) % 2}s`, 'critter'), free === 'left' ? 'right' : 'left')
        || place(100, 110, y0 - 40, y1 - 50, 0, (x, y) => sprite(art(critter), `left:${x}px;top:${y}px;width:100px;height:110px`, 'critter'), free);
    }
    // Smaller things.
    const small = z.small[Math.floor(rng() * z.small.length)];
    const [sw, sh] = SMALL[small];
    place(sw, sh, y0, y1, 0, (x, y) => sprite(art(small), `left:${x}px;top:${y}px;width:${sw}px;height:${sh}px`, 'prop'), null, true);
    if (!z.snowy) place(48, 46, y0, y1, 0, (x, y) => sprite(art('rocks'), `left:${x}px;top:${y}px;width:48px;height:46px`));
    for (let f = 0; f < 3; f++) {
      const c = z.flowers[Math.floor(rng() * z.flowers.length)];
      place(24, 24, y0, y1, 0, (x, y) => sprite(art(`flower-${c}`), `left:${x}px;top:${y}px;width:24px;height:24px`));
    }
    const tuft = art(z.snowy ? 'tuft-snow' : 'tuft');
    for (let g = 0; g < 2; g++) place(26, 22, y0, y1, 0, (x, y) => sprite(tuft, `left:${x}px;top:${y}px;width:26px;height:22px`));
  }

  // Zone extras: the sea, mountains, falling petals and snow.
  ZONES.forEach((z, zi) => {
    const first = nodes[z.from - 1];
    if (!first) return;
    const lastId = Math.min(levels.length, (ZONES[zi + 1]?.from ?? Infinity) - 1);
    const top = nodes[lastId - 1].y - SPACING / 2, bottom = first.y + SPACING / 2;
    if (z.sea) {
      out.unshift(sea(top, bottom - top));
      // Boats on the water, shells and starfish on the wet sand.
      for (let y = top + 140, k = 0; y < bottom - 120; y += 300, k++) {
        out.push(sprite(art('sailboat'), `left:${4 + (k % 2) * 10}px;top:${y}px;width:46px;height:50px;animation-delay:-${k * 1.3}s`, 'bobbing'));
        out.push(sprite(art(k % 2 ? 'shell' : 'starfish'), `left:${92 + (k % 3) * 9}px;top:${y + 150}px;width:26px;height:26px`));
      }
    }
    if (z.snowy) {
      out.unshift(sprite(art('mountains'), `left:0;top:${top - 150}px;width:${width}px;height:${width * 0.36}px`, 'far'));
      for (let k = 0; k < 18; k++) out.push(`<i class="flake" style="left:${(k * 47) % width}px;top:${top + (k * 97) % (bottom - top)}px;animation-delay:-${k * 0.7}s"></i>`);
      for (let k = 0; k < 4; k++) {
        const x = 30 + ((k * 113) % (width - 80)), y = top + 80 + k * ((bottom - top - 160) / 4);
        out.push(sprite(steam(), `left:${x}px;top:${y}px;animation-delay:-${k}s`, 'steam'));
      }
    }
    if (z.night) for (let k = 0; k < 22; k++) out.push(`<i class="firefly" style="left:${(k * 71) % width}px;top:${top + (k * 89) % (bottom - top)}px;animation-delay:-${k * 0.6}s"></i>`);
    if (z.petals) for (let k = 0; k < 16; k++) out.push(`<i class="petal" style="left:${(k * 59) % width}px;top:${top + (k * 83) % (bottom - top)}px;animation-delay:-${k * 0.9}s"></i>`);
  });

  // Things in the air.
  for (let i = 0; i < nodes.length; i += 4) {
    out.push(sprite(butterfly(['#8b5cf6', '#ff6fae', '#2ec4d6'][i % 3]), `left:${20 + ((i * 53) % (width - 80))}px;top:${nodes[i].y - 70}px;width:30px;height:22px;animation-delay:-${i}s`, 'flutter'));
  }
  for (let i = 3; i < nodes.length; i += 7) {
    out.push(sprite(bird(), `left:-40px;top:${nodes[i].y - 40}px;width:30px;height:14px;animation-delay:-${i}s`, 'fly'));
    out.push(sprite(bird(), `left:-70px;top:${nodes[i].y - 20}px;width:24px;height:11px;animation-delay:-${i + 0.4}s`, 'fly'));
  }
  [[6, 0.6, 64], [17, 0.1, 54], [27, 0.66, 60], [36, 0.14, 56]].forEach(([i, fx, w]) => {
    if (nodes[i]) out.push(sprite(art('balloon'), `left:${width * fx}px;top:${nodes[i].y - 80}px;width:${w}px;height:${w * 1.38}px;animation-delay:-${i}s`, 'float'));
  });
  for (let i = 0; i < 5; i++) {
    out.push(sprite(art('cloud'), `left:${(i * 131) % width}px;top:${30 + i * 56}px;width:${120 - i * 10}px;height:${60 - i * 5}px;animation-delay:-${i * 9}s`, 'cloud slow'));
  }
  return out.join('');
}

// Draws the map into `el`. `progress` is a save.js Progress; `onPick(level)`
// is called when an unlocked level is tapped. With `from` (a level id), the
// host travels from that level to the current one and the new level pops
// in. Returns the current level and where it is.
export function renderMap(el, levels, progress, onPick, { from = null } = {}) {
  const width = el.clientWidth || window.innerWidth;
  const { height, nodes, samples, road, rope } = layout(levels.length, width);
  const unlocked = Math.min(progress.unlocked(), levels.length);
  const current = levels[unlocked - 1];
  // How far along the rope is "done": up to the current level.
  const path = `<svg class="map-path" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">
    <path d="${road}" stroke="rgba(120,70,20,.25)" stroke-width="104" fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 6)"/>
    <path d="${road}" stroke="#d9a35f" stroke-width="100" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${road}" stroke="#ffe3ad" stroke-width="88" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${road}" stroke="#fff2d2" stroke-width="40" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".6"/>
    <path d="${rope}" stroke="#ff8fc1" stroke-width="12" fill="none" stroke-linecap="round"/>
    <path d="${rope}" stroke="#ffffff" stroke-width="12" fill="none" stroke-dasharray="7 9"/>
  </svg>`;

  // A wooden arch over the road where each zone begins.
  const gates = ZONES.filter((z) => z.from <= levels.length).map((z, zi) => {
    const y = nodes[z.from - 1].y + 170;
    const x = roadX(samples, y);
    const last = Math.min(levels.length, (ZONES[zi + 1]?.from ?? Infinity) - 1);
    return `<div class="gate" style="left:${x}px;top:${y}px"><div class="gate-sign">${art('sign')}<span><b>${z.name}</b><small>Levels ${z.from}–${last}</small></span></div></div>`;
  }).join('');
  const top = nodes[nodes.length - 1];
  const soon = `<div class="sign soon" style="left:${Math.max(8, top.x - 90)}px;top:${top.y - 200}px">More levels soon!</div>`;

  el.style.height = `${height}px`;
  // A soft mottled tile over the zone colors, so the ground is not flat.
  el.style.background = `url("./art/map/ground.png") 0 0 / 256px 256px, ${groundGradient(levels, nodes, height)}`;
  el.innerHTML = decorations(levels, width, height, samples, nodes) + path + gates + soon;

  levels.forEach((level, i) => {
    const p = nodes[i];
    const best = progress.level(level.id);
    const locked = level.id > unlocked;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `node ${locked ? 'locked' : level.goal.type}${level.id === unlocked ? ' current' : ''}`;
    btn.style.cssText = `left:${p.x}px;top:${p.y}px`;
    btn.setAttribute('aria-label', locked ? `Level ${level.id}, locked` : `Level ${level.id}, ${best.stars} stars`);
    if (!locked) {
      const num = document.createElement('b');
      num.textContent = String(level.id);
      btn.append(num);
      btn.addEventListener('click', () => onPick(level));
    } else {
      btn.disabled = true;
    }
    el.append(btn);
    if (!locked && level.id !== unlocked) {
      const stars = document.createElement('div');
      stars.className = 'node-stars';
      stars.style.cssText = `left:${p.x}px;top:${p.y + 40}px`;
      stars.setAttribute('aria-hidden', 'true');
      for (let s = 0; s < 3; s++) {
        const star = document.createElement('i');
        if (s >= best.stars) star.className = 'off';
        stars.append(star);
      }
      el.append(stars);
    }
  });

  // The host's portrait waits beside the next level to play.
  const cur = nodes[unlocked - 1];
  const side = cur.x > width / 2 ? -1 : 1;
  const frame = document.createElement('div');
  frame.className = 'avatar map-avatar';
  frame.style.cssText = `left:${cur.x + side * 86 - 36}px;top:${cur.y - 36}px`;
  frame.innerHTML = capy('cheer'); // our own art, never user input
  el.append(frame);

  if (from && from < unlocked && nodes[from - 1]) {
    const start = nodes[from - 1];
    const startSide = start.x > width / 2 ? -1 : 1;
    const dx = start.x + startSide * 86 - (cur.x + side * 86), dy = start.y - cur.y;
    frame.animate([
      { transform: `translate(${dx}px, ${dy}px)` },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 40}px) scale(1.15)`, offset: 0.5 },
      { transform: 'translate(0, 0)' },
    ], { duration: 1100, easing: 'ease-in-out', fill: 'backwards' });
    el.querySelector('.node.current')?.animate([
      { transform: 'scale(0.3)', filter: 'brightness(2)' },
      { transform: 'scale(1.35)', offset: 0.6 },
      { transform: 'scale(1)' },
    ], { duration: 650, delay: 950, easing: 'ease-out', fill: 'backwards' });
  }

  return { current, y: cur.y, fromY: from && nodes[from - 1] ? nodes[from - 1].y : null };
}
