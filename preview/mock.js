// Builds the look-and-feel mockup. ?screen=game | map | review
import { fruit, striped, wrapped, bomb, ducky, pup } from '../src/art/pieces.js';
import { capy } from '../src/art/capy.js';
import { palm, cloud, hills, pool, steam, flower, bush, butterfly, sun } from '../src/art/scene.js';

const screen = new URLSearchParams(location.search).get('screen') ?? 'game';
const root = document.getElementById('root');
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const sprite = (svg, style, cls = '') => `<div class="sprite ${cls}" style="${style}">${svg}</div>`;

// ---- the hot-spring world behind the board ---------------------------------

function world() {
  const steams = [[40, 770, 0], [120, 800, 1.2], [300, 790, 2.1], [380, 760, 0.6], [210, 820, 2.8]]
    .map(([x, y, d]) => sprite(steam(), `left:${x}px;top:${y}px;animation-delay:-${d}s`, 'steam')).join('');
  return `<div class="world">
    <div class="sky"></div><div class="rays"></div>
    ${sprite(sun(), 'left:300px;top:40px;width:110px;height:110px', 'bob')}
    ${sprite(cloud(), 'left:20px;top:150px;width:150px;height:76px', 'cloud')}
    ${sprite(cloud(), 'left:-120px;top:230px;width:110px;height:56px;animation-delay:-20s', 'cloud slow')}
    ${sprite(hills(), 'left:0;right:0;top:420px;width:440px;height:200px')}
    ${sprite(palm(), 'left:-40px;top:300px;width:150px;height:300px', 'sway')}
    ${sprite(palm(true), 'left:330px;top:250px;width:160px;height:330px', 'sway b')}
    ${sprite(bush(), 'left:150px;top:560px;width:120px;height:60px')}
    ${sprite(flower(), 'left:120px;top:600px;width:30px;height:30px')}
    ${sprite(flower('#ffb02e'), 'left:300px;top:604px;width:26px;height:26px')}
    <div class="water"></div>
    ${steams}
    ${sprite(ducky(), 'left:330px;top:840px;width:60px;height:60px', 'bob')}
    ${sprite(ducky(), 'left:250px;top:880px;width:46px;height:46px', 'bob b')}
    ${sprite(butterfly(), 'left:60px;top:250px;width:34px;height:26px', 'flutter')}
    ${sprite(butterfly('#ff6fae'), 'left:260px;top:180px;width:30px;height:22px;animation-delay:-3s', 'flutter')}
  </div>`;
}

// ---- the board ---------------------------------------------------------------

const ROWS = ['roygbpgyo', 'bgproybrp', 'ypobgrygb', 'orgypbopr', 'pbroygrby', 'gybpropog', 'rogybpyrb', 'ybprgobgp', 'ogrbpyroy'];
const HOLES = new Set(['0,0', '0,8', '8,0', '8,8']);
const SPECIAL = { '2,2': () => striped('r', 'h'), '3,6': () => striped('g', 'v'), '5,4': () => wrapped('o'), '6,1': bomb, '1,6': ducky };
const foam = (r, c) => (r >= 6 && c >= 2 && c <= 6 ? (r === 7 && c >= 3 && c <= 5 ? 'foam2' : 'foam') : '');

function board() {
  let cells = '';
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++) {
      const k = `${r},${c}`;
      if (HOLES.has(k)) { cells += `<div class="cell hole"></div>`; continue; }
      const art = SPECIAL[k] ? SPECIAL[k]() : fruit(ROWS[r][c]);
      cells += `<div class="cell ${foam(r, c)}"><div class="piece">${art}</div></div>`;
    }
  return `<div class="board">${cells}</div>`;
}

function hud() {
  const marks = [[38, '1', true], [66, '2', false], [100, '3', false]]
    .map(([x, n, on]) => `<div class="meter-star ${on ? 'on' : ''}" style="left:${Math.min(x, 96)}%"><i></i></div>`).join('');
  return `
    <div class="hud">
      <div class="moves"><small>MOVES</small><b class="toon">18</b></div>
      <div class="panel goal"><div class="foam-icon"></div>
        <div><div class="label">Clear the foam</div><div class="count">23 left</div></div></div>
      <div class="round-btn"><svg viewBox="0 0 24 24" width="22" height="22" style="width:22px;height:22px"><rect x="6" y="5" width="4" height="14" rx="1.5" fill="#fff"/><rect x="14" y="5" width="4" height="14" rx="1.5" fill="#fff"/></svg></div>
    </div>
    <div class="panel meter-wrap">
      <div class="score-line"><span class="label">SCORE</span><b>24,850</b></div>
      <div class="meter"><div class="meter-fill" style="width:52%"></div>${marks}</div>
    </div>`;
}

function boosters() {
  const icon = {
    smash: `<svg viewBox="0 0 60 60"><rect x="27" y="22" width="7" height="34" rx="3" fill="#c98a4b" stroke="#6b3f1c" stroke-width="2.5" transform="rotate(35 30 40)"/><rect x="10" y="8" width="34" height="18" rx="7" fill="#ff5fa2" stroke="#8a1748" stroke-width="3" transform="rotate(35 27 17)"/></svg>`,
    swap: `<svg viewBox="0 0 60 60"><path d="M12 22h30l-7-7M48 38H18l7 7" stroke="#2e86ff" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    shuffle: `<svg viewBox="0 0 60 60"><path d="M10 18h10l20 24h10M10 42h10l6-7M34 25l6-7h10M44 12l6 6-6 6M44 36l6 6-6 6" stroke="#9b4dff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    moves: `<svg viewBox="0 0 60 60"><text x="30" y="42" text-anchor="middle" font-family="Lilita One" font-size="32" fill="#3fbf4a" stroke="#1b7a28" stroke-width="2">+5</text></svg>`,
  };
  return `<div class="tray-row"><div class="host-spot"></div><div class="tray">${[['smash', 60], ['swap', 40], ['shuffle', 30], ['moves', 90]].map(([k, p]) =>
    `<div class="booster">${icon[k]}<div class="price"><i class="coin"></i>${p}</div></div>`).join('')}</div></div>`;
}

function gameScreen() {
  root.innerHTML = world() + `<div class="screen">${hud()}${board()}${boosters()}</div>` +
    sprite(capy('cheer'), 'left:2px;top:792px;width:118px;height:126px;z-index:2', 'host') +
    `<div class="bubble" style="left:58px;top:742px;z-index:3">Juicy!</div>` +
    `<div class="callout toon" style="top:420px;z-index:4">Juicy!</div>`;
}

// ---- review --------------------------------------------------------------------

function reviewScreen() {
  gameScreen();
  root.querySelector('.callout').remove();
  root.querySelector('.bubble').remove();
  const chip = (svg, n) => `<span class="chip"><span>${svg}</span>×${n}</span>`;
  const colors = ['#ff5fa2', '#ffcf3a', '#2ec4d6', '#3fbf4a', '#9b4dff', '#ff9f1c'];
  const confetti = Array.from({ length: 26 }, (_, i) =>
    `<i class="confetti" style="left:${(i * 37) % 440}px;top:${-((i * 53) % 300)}px;background:${colors[i % 6]};animation-delay:-${(i * 0.37) % 3}s"></i>`).join('');
  root.insertAdjacentHTML('beforeend', `<div class="dim"></div>
    <div class="review">
      <div class="ribbon toon">Level 12</div>
      <div class="big-stars"><i></i><i></i><i class="off"></i></div>
      <div class="final toon">24,850</div>
      <div class="badge">NEW BEST!</div>
      <div class="stats">
        <div class="stat"><span class="name">Specials made</span><span class="val">
          ${chip(striped('r', 'h'), 4)}${chip(wrapped('o'), 2)}${chip(bomb(), 1)}</span></div>
        <div class="stat"><span class="name">Biggest chain</span><span class="val">×7 cascade</span></div>
        <div class="stat"><div class="ico foam-icon" style="width:32px;height:32px"></div><span class="name">Foam cleared</span><span class="val">42</span></div>
        <div class="stat"><span class="name">Moves left → bonus</span><span class="val">5 → +3,000</span></div>
        <div class="stat"><span class="name">Coins earned</span><span class="val"><i class="coin"></i>+45</span></div>
      </div>
      <div class="actions"><div class="btn orange toon">Replay</div><div class="btn green toon">Next ▸</div></div>
    </div>
    ${sprite(capy('cheer'), 'left:-10px;top:40px;width:130px;height:140px;z-index:7;transform:rotate(-10deg)', 'host')}
    ${confetti}`);
}

// ---- map -------------------------------------------------------------------------

function mapScreen() {
  // A winding path from the bottom up; nodes along it.
  const W = 440, H = 956;
  const pts = Array.from({ length: 9 }, (_, i) => ({ x: W / 2 + Math.sin(i * 0.9 + 0.4) * 120, y: H - 120 - i * 104 }));
  let d = `M ${pts[0].x} ${H + 40} L ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], my = (a.y + b.y) / 2;
    d += ` C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`;
  }
  const path = `<svg class="map-path" viewBox="0 0 ${W} ${H}">
    <path d="${d}" stroke="#c98a4b" stroke-width="58" fill="none" stroke-linecap="round"/>
    <path d="${d}" stroke="#ffe0a3" stroke-width="46" fill="none" stroke-linecap="round"/>
    <path d="${d}" stroke="#fff4d6" stroke-width="6" fill="none" stroke-dasharray="2 18" stroke-linecap="round"/>
  </svg>`;
  const types = ['', 'jelly', 'ingr', '', 'jelly', '', 'ingr', 'jelly', ''];
  const current = 4;
  const nodes = pts.map((p, i) => {
    const n = 10 + i;
    const cls = i < current ? types[i] : i === current ? `current ${types[i]}` : 'locked';
    const stars = i < current ? `<div class="node-stars" style="left:${p.x}px;top:${p.y - 36}px"><i></i><i></i><i class="${i % 2 ? 'off' : ''}"></i></div>` : '';
    return `<div class="node ${cls}" style="left:${p.x}px;top:${p.y}px"><b>${i <= current ? n : ''}</b></div>${stars}`;
  }).join('');
  const cur = pts[current];
  const deco = [
    sprite(cloud(), 'left:40px;top:120px;width:120px;height:60px', 'cloud'),
    sprite(palm(), 'left:-30px;top:520px;width:120px;height:240px', 'sway'),
    sprite(palm(true), 'left:350px;top:330px;width:110px;height:220px', 'sway b'),
    sprite(pool(), 'left:250px;top:640px;width:170px;height:80px'),
    sprite(steam(), 'left:300px;top:610px;animation-delay:-1s', 'steam'),
    sprite(steam(), 'left:350px;top:620px;animation-delay:-2.5s', 'steam'),
    sprite(ducky(), 'left:300px;top:650px;width:40px;height:40px', 'bob'),
    sprite(pool(), 'left:10px;top:250px;width:150px;height:70px'),
    sprite(steam(), 'left:60px;top:220px;animation-delay:-.5s', 'steam'),
    sprite(pup(), 'left:40px;top:250px;width:40px;height:40px', 'bob b'),
    sprite(bush(), 'left:330px;top:820px;width:110px;height:55px'),
    sprite(bush(), 'left:0;top:420px;width:100px;height:50px'),
    sprite(flower(), 'left:140px;top:860px;width:28px;height:28px'),
    sprite(flower('#ffb02e'), 'left:390px;top:540px;width:26px;height:26px'),
    sprite(flower('#9b4dff'), 'left:30px;top:700px;width:24px;height:24px'),
    sprite(butterfly(), 'left:180px;top:300px;width:32px;height:24px', 'flutter'),
    sprite(butterfly('#ff6fae'), 'left:80px;top:600px;width:28px;height:22px;animation-delay:-4s', 'flutter'),
    `<div class="sign" style="left:250px;top:450px;transform:rotate(4deg)">Yuzu Valley</div>`,
    ...Array.from({ length: 34 }, (_, i) => {
      const x = (i * 97) % 430, y = 120 + ((i * 211) % 820);
      return `<div class="tuft" style="left:${x}px;top:${y}px"></div>`;
    }),
    ...[[200, 760, '#ff6fae'], [380, 260, '#ffb02e'], [20, 860, '#ff6fae'], [260, 120, '#9b4dff'], [110, 470, '#ffb02e']]
      .map(([x, y, c]) => sprite(flower(c), `left:${x}px;top:${y}px;width:24px;height:24px`)),
  ].join('');
  root.innerHTML = `<div class="map-world">${path}${deco}${nodes}
    ${sprite(capy('cheer'), `left:${cur.x + 26}px;top:${cur.y - 110}px;width:96px;height:104px;z-index:2`, 'host idle')}
    </div>
    <div class="topbar">
      <div class="pill"><span class="heart">5</span>Full</div>
      <div class="pill"><i class="coin" style="width:28px;height:28px"></i>1,240</div>
      <div style="flex:1"></div>
      <div class="round-btn" style="width:46px;height:46px"><svg viewBox="0 0 24 24" style="width:24px;height:24px"><circle cx="12" cy="12" r="4" fill="none" stroke="#fff" stroke-width="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg></div>
    </div>
    <div class="play-btn toon">Play ${10 + current}</div>`;
}

({ game: gameScreen, review: reviewScreen, map: mapScreen })[screen]();
