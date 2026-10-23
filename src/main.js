import { Game } from './game.js';
import { LEVELS } from './levels.js';
import { Progress } from './save.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString('en-US');
const progress = new Progress();
let current = null; // the level being played

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c) node.append(c);
  return node;
}

function starRow(count, cls = 'stars') {
  return el('div', { class: cls, 'aria-label': `${count} of 3 stars` },
    ...[0, 1, 2].map((i) => el('b', { class: i < count ? 'on' : '' })));
}

// ---- screens ---------------------------------------------------------------

function showMap() {
  game?.stop();
  $('game-screen').hidden = true;
  $('map-screen').hidden = false;
  renderMap();
}

function showGame(level) {
  current = level;
  $('map-screen').hidden = true;
  $('game-screen').hidden = false;
  $('level-name').textContent = `Level ${level.id}`;
  // Star marks along the score bar at each threshold.
  const top = level.stars[2];
  [...$('score-marks').children].forEach((mark, i) => (mark.style.left = `${(level.stars[i] / top) * 100}%`));
  getGame().start(level);
}

// ---- map -------------------------------------------------------------------

const SPACING = 104;
const PAD = 90;

function renderMap() {
  const path = $('map-path');
  const unlocked = progress.unlocked();
  path.replaceChildren();
  const width = path.clientWidth || window.innerWidth;
  const height = PAD * 2 + (LEVELS.length - 1) * SPACING;
  path.style.height = `${height}px`;
  const swing = Math.min(120, width / 2 - 56);
  const pos = (i) => ({ x: width / 2 + Math.sin(i * 0.85) * swing, y: height - PAD - i * SPACING });

  // The glowing trail between levels.
  const pts = LEVELS.map((_, i) => pos(i));
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const my = (a.y + b.y) / 2;
    d += ` C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`;
  }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'map-trail');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('aria-hidden', 'true');
  const done = pts[Math.min(unlocked, pts.length) - 1];
  for (const cls of ['trail-dim', 'trail-lit']) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    p.setAttribute('class', cls);
    svg.append(p);
  }
  // Only light the trail up to the next level to play.
  const lit = svg.lastChild;
  const total = lit.getTotalLength?.() ?? 0;
  if (total) {
    let len = 0;
    // Find the length along the path to the unlocked node.
    for (let s = 0; s <= total; s += 8) {
      const pt = lit.getPointAtLength(s);
      if (pt.y <= done.y + 1) { len = s; break; }
    }
    lit.style.strokeDasharray = `${len} ${total}`;
  }
  path.append(svg);

  LEVELS.forEach((level, i) => {
    const { x, y } = pos(i);
    const best = progress.level(level.id);
    const locked = level.id > unlocked;
    const state = locked ? 'locked' : level.id === unlocked ? 'current' : 'done';
    const node = el('button', {
      class: `map-node ${state} goal-${level.goal.type}`,
      type: 'button',
      style: `left:${x}px;top:${y}px`,
      'aria-label': locked ? `Level ${level.id}, locked` : `Level ${level.id}, ${best.stars} stars`,
      onclick: () => !locked && showIntro(level),
    },
      el('span', { class: 'map-num', text: locked ? '' : String(level.id) }),
      locked ? el('i', { class: 'lock', 'aria-hidden': 'true' }) : null,
    );
    if (locked) node.setAttribute('aria-disabled', 'true');
    path.append(node);
    if (!locked) {
      const stars = starRow(best.stars, 'stars map-stars');
      stars.style.cssText = `left:${x}px;top:${y + 36}px`;
      path.append(stars);
    }
  });

  $('total-stars').textContent = `${progress.totalStars()} / ${LEVELS.length * 3}`;
  // Scroll so the next level to play sits low on the screen.
  const scroller = $('map-scroll');
  const target = pos(Math.min(unlocked, LEVELS.length) - 1).y - scroller.clientHeight * 0.62;
  scroller.scrollTop = Math.max(0, target);
}

// ---- dialogs ---------------------------------------------------------------

function goalText(level) {
  switch (level.goal.type) {
    case 'jelly':
      return 'Clear all the jelly';
    case 'ingredients':
      return `Bring down ${level.goal.count} ingredients`;
    default:
      return `Score ${fmt(level.stars[0])} points`;
  }
}

function openDialog(title, body, actions) {
  $('dialog-title').textContent = title;
  $('dialog-body').replaceChildren(...body.filter(Boolean));
  $('dialog-actions').replaceChildren(...actions);
  $('dialog').hidden = false;
  $('dialog-actions').querySelector('button')?.focus();
}

function closeDialog() {
  $('dialog').hidden = true;
}

function button(text, onclick, primary = false) {
  return el('button', { class: primary ? 'cta' : 'cta cta-ghost', type: 'button', text, onclick });
}

function showIntro(level) {
  const best = progress.level(level.id);
  openDialog(`Level ${level.id}`, [
    starRow(best.stars, 'stars stars-big'),
    el('p', { class: 'goal-text' }, el('i', { class: `goal-icon ${level.goal.type}`, 'aria-hidden': 'true' }), goalText(level)),
    el('p', { class: 'muted', text: `in ${level.moves} moves` }),
    best.best ? el('p', { class: 'muted', text: `Best score ${fmt(best.best)}` }) : null,
  ], [
    button('Play', () => { closeDialog(); showGame(level); }, true),
    button('Back', closeDialog),
  ]);
}

function showResult(r) {
  const level = current;
  if (r.won) {
    progress.record(level.id, r.stars, r.score);
    const next = LEVELS.find((l) => l.id === level.id + 1);
    openDialog('Level complete', [
      starRow(r.stars, 'stars stars-big'),
      el('p', {}, 'Score ', el('strong', { text: fmt(r.score) })),
    ], [
      next ? button('Next level', () => { closeDialog(); showMap(); showIntro(next); }, true)
        : button('You beat them all!', () => { closeDialog(); showMap(); }, true),
      button('Map', () => { closeDialog(); showMap(); }),
    ]);
  } else {
    const why = r.goal === 'jelly' ? `${r.jellyLeft} jelly left`
      : r.goal === 'ingredients' ? `${r.ingredientsLeft} ingredient${r.ingredientsLeft === 1 ? '' : 's'} to go`
      : `Needed ${fmt(r.target)} points`;
    openDialog('Out of moves', [
      el('p', { class: 'goal-text', text: why }),
      el('p', {}, 'Score ', el('strong', { text: fmt(r.score) })),
    ], [
      button('Try again', () => { closeDialog(); showGame(level); }, true),
      button('Map', () => { closeDialog(); showMap(); }),
    ]);
  }
}

function showBanner(text) {
  const b = $('banner');
  b.textContent = text;
  b.hidden = false;
  b.classList.remove('play');
  void b.offsetWidth; // restart the animation
  b.classList.add('play');
  clearTimeout(showBanner.timer);
  showBanner.timer = setTimeout(() => (b.hidden = true), 1600);
}

// ---- the game --------------------------------------------------------------

let game = null;
function getGame() {
  game ??= new Game($('board'), {
    onChange: updateHud,
    onBanner: showBanner,
    onEnd: (r) => setTimeout(() => showResult(r), 300),
  });
  window.jankyCrush = game; // handy from the Safari Web Inspector and the smoke tests
  return game;
}

function updateHud(h) {
  const level = current;
  $('moves').textContent = h.moves;
  $('score').textContent = fmt(h.score);
  $('score-fill').style.width = `${Math.min(100, (h.score / level.stars[2]) * 100)}%`;
  [...$('score-stars').children].forEach((s, i) => s.classList.toggle('on', i < h.stars));
  const icon = $('goal-icon');
  icon.className = `goal-icon ${h.goal}`;
  if (h.goal === 'jelly') {
    $('goal-value').textContent = h.jellyLeft;
    $('goal-sub').textContent = 'jelly left';
  } else if (h.goal === 'ingredients') {
    $('goal-value').textContent = h.ingredientsLeft;
    $('goal-sub').textContent = 'to bring down';
  } else {
    $('goal-value').textContent = fmt(level.stars[0]);
    $('goal-sub').textContent = 'points';
  }
}

$('to-map').addEventListener('click', () => {
  if (game && !game.over && game.state && game.state.moves < current.moves) {
    openDialog('Leave this level?', [el('p', { class: 'muted', text: 'This attempt won’t be saved.' })], [
      button('Leave', () => { closeDialog(); showMap(); }, true),
      button('Keep playing', closeDialog),
    ]);
  } else {
    showMap();
  }
});

$('restart').addEventListener('click', () => {
  if (current && game && !game.busy) game.start(current);
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    game?.resize();
    if (!$('map-screen').hidden) renderMap();
  }, 100);
});

// Stop iOS pinch-zoom and double-tap zoom from fighting the board.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js');
}

showMap();
