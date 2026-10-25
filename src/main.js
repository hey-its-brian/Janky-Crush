import { Game } from './game.js';
import { LEVELS } from './levels.js';
import { Progress } from './save.js';
import { buildWorld } from './ui/world.js';
import { renderMap } from './ui/map.js';
import { capy } from './art/capy.js';
import { ducky, striped, wrapped, bomb } from './art/pieces.js';
import { unlockAudio, play } from './audio/sfx.js';
import { playMusic } from './audio/music.js';
import { announce, primeVoice } from './audio/voice.js';
import { haptic } from './audio/haptics.js';
import { getSetting, setSetting } from './settings.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString('en-US');
const progress = new Progress();
let current = null; // the level being played

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'svg') node.innerHTML = v; // our own SVG art only
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c) node.append(c);
  return node;
}

function bigStars(count) {
  const row = el('div', { class: 'big-stars', 'aria-label': `${count} of 3 stars` });
  [0, 1, 2].forEach((i) => {
    const star = el('i', { class: i < count ? 'on' : '' });
    star.style.animationDelay = `${0.25 + i * 0.25}s`;
    row.append(star);
  });
  return row;
}

// ---- screens ---------------------------------------------------------------

function showMap() {
  game?.stop();
  closeDialog();
  $('game-screen').hidden = true;
  $('world').hidden = true;
  $('map-screen').hidden = false;
  playMusic('map');
  const { current: next, y } = renderMap($('map'), LEVELS, progress, (level) => { tapFeedback(); showIntro(level); });
  $('total-stars').textContent = `${progress.totalStars()} / ${LEVELS.length * 3}`;
  $('play-btn').textContent = `Play ${next.id}`;
  $('play-btn').onclick = () => { tapFeedback(); showIntro(next); };
  // Bring the next level to play into view, low on the screen.
  const scroller = $('map-scroll');
  scroller.scrollTop = Math.max(0, y - scroller.clientHeight * 0.6);
}

function showGame(level) {
  current = level;
  closeDialog();
  $('map-screen').hidden = true;
  $('world').hidden = false;
  $('game-screen').hidden = false;
  // Star marks along the meter at each threshold (the third sits at the end).
  const top = level.stars[2];
  [...document.querySelectorAll('.meter-star')].forEach((mark, i) => {
    mark.style.left = `${Math.min(96, (level.stars[i] / top) * 100)}%`;
  });
  setHost('idle');
  $('host-bubble').hidden = true;
  playMusic('level');
  getGame().start(level);
}

// ---- the host and callouts ---------------------------------------------------

let hostPose = null;
let hostTimer;
function setHost(pose) {
  if (pose === hostPose) return;
  hostPose = pose;
  $('host').innerHTML = capy(pose); // our own SVG art
}

function cheer(text) {
  setHost('cheer');
  const host = $('host');
  host.classList.remove('cheer');
  void host.offsetWidth;
  host.classList.add('cheer');
  const bubble = $('host-bubble');
  bubble.textContent = text;
  bubble.hidden = false;
  clearTimeout(hostTimer);
  hostTimer = setTimeout(() => {
    bubble.hidden = true;
    host.classList.remove('cheer');
    setHost(game?.state?.moves <= 3 && !game.over ? 'worried' : 'idle');
  }, 1800);
}

// Callout words get bigger jingles as they get rarer.
const CHEER_TIER = { 'Juicy!': 1, 'Fresh!': 2, 'Tropical!': 3, 'Smoothie!': 4 };

function callout(text) {
  play('cheer', { tier: CHEER_TIER[text] ?? 1 });
  announce(text);
  haptic(1);
  const c = $('callout');
  c.textContent = text;
  c.hidden = false;
  c.classList.remove('play');
  void c.offsetWidth;
  c.classList.add('play');
  clearTimeout(callout.timer);
  callout.timer = setTimeout(() => (c.hidden = true), 1300);
  cheer(text);
}

function showBanner(text) {
  play('fanfare');
  announce(text);
  haptic(2);
  const b = $('banner');
  b.textContent = text;
  b.hidden = false;
  b.classList.remove('play');
  void b.offsetWidth;
  b.classList.add('play');
  clearTimeout(showBanner.timer);
  showBanner.timer = setTimeout(() => (b.hidden = true), 1600);
  cheer(text);
}

// ---- dialogs ---------------------------------------------------------------

function goalText(level) {
  switch (level.goal.type) {
    case 'jelly':
      return 'Clear all the bath foam';
    case 'ingredients':
      return `Bring ${level.goal.count} friends down to the spring`;
    default:
      return `Score ${fmt(level.stars[0])} points`;
  }
}

function goalIcon(type) {
  const icon = el('i', { class: `goal-icon ${type}`, 'aria-hidden': 'true' });
  if (type === 'ingredients') icon.innerHTML = ducky(); // our own SVG art
  return icon;
}

function openDialog(title, body, actions, { host = null, confetti = false, stack = false } = {}) {
  $('dialog-title').textContent = title;
  $('dialog-body').replaceChildren(...body.filter(Boolean));
  $('dialog-actions').replaceChildren(...actions);
  $('dialog-actions').classList.toggle('stack', stack);
  $('dialog-host').innerHTML = host ? capy(host) : ''; // our own SVG art
  const layer = $('confetti');
  layer.replaceChildren();
  if (confetti) {
    const colors = ['#ff5fa2', '#ffcf3a', '#2ec4d6', '#3fbf4a', '#9b4dff', '#ff9f1c'];
    for (let i = 0; i < 30; i++) {
      const bit = el('i');
      bit.style.cssText = `left:${(i * 37) % 100}%;background:${colors[i % 6]};animation-delay:-${(i * 0.37) % 3}s;animation-duration:${2.4 + (i % 5) * 0.3}s`;
      layer.append(bit);
    }
  }
  $('dialog').hidden = false;
  $('dialog-actions').querySelector('button')?.focus();
}

function closeDialog() {
  $('dialog').hidden = true;
  $('confetti').replaceChildren();
}

function tapFeedback() {
  play('click');
  haptic(1);
}

function button(text, onclick, color = 'green') {
  return el('button', { class: `btn ${color} toon`, type: 'button', text, onclick: () => { tapFeedback(); onclick(); } });
}

function showIntro(level) {
  const best = progress.level(level.id);
  openDialog(`Level ${level.id}`, [
    bigStars(best.stars),
    el('p', { class: 'goal-text' }, goalIcon(level.goal.type), goalText(level)),
    el('p', { class: 'muted', text: `in ${level.moves} moves` }),
    best.best ? el('p', { class: 'muted', text: `Best score ${fmt(best.best)}` }) : null,
  ], [
    button('Back', closeDialog, 'orange'),
    button('Play!', () => showGame(level)),
  ], { host: 'idle' });
}

function statRow(name, value, icon = null) {
  return el('div', { class: 'stat' }, icon, el('span', { class: 'name', text: name }), value);
}

function showResult(r) {
  const level = current;
  if (r.won) {
    const before = progress.level(level.id).best;
    progress.record(level.id, r.stars, r.score);
    const next = LEVELS.find((l) => l.id === level.id + 1);
    const s = r.stats;
    const chip = (svg, n) => el('span', { class: 'chip' }, el('span', { svg }), `×${n}`);
    const specials = el('span', { class: 'val' },
      s.striped ? chip(striped('r', 'h'), s.striped) : null,
      s.wrapped ? chip(wrapped('o'), s.wrapped) : null,
      s.bomb ? chip(bomb(), s.bomb) : null);
    const rows = [
      s.striped + s.wrapped + s.bomb ? statRow('Specials made', specials) : null,
      s.bestCascade > 1 ? statRow('Biggest chain', el('span', { class: 'val', text: `×${s.bestCascade}` })) : null,
      s.foamCleared ? statRow('Foam cleared', el('span', { class: 'val', text: fmt(s.foamCleared) }), el('i', { class: 'foam-icon goal-icon', style: 'width:30px;height:30px' })) : null,
      r.collected ? statRow('Friends rescued', el('span', { class: 'val', text: String(r.collected) }), el('i', { class: 'goal-icon', svg: ducky(), style: 'width:32px;height:32px' })) : null,
      s.bonus ? statRow('Leftover moves bonus', el('span', { class: 'val', text: `+${fmt(s.bonus)}` })) : null,
    ].filter(Boolean);
    const score = el('div', { class: 'final toon', text: '0' });
    countUp(score, r.score);
    play('win');
    for (let i = 0; i < r.stars; i++) setTimeout(() => { play('star', { i }); haptic(1); }, 250 + i * 250 + 300);
    openDialog(`Level ${level.id}`, [
      bigStars(r.stars),
      score,
      r.score > before && before > 0 ? el('div', { class: 'badge', text: 'NEW BEST!' }) : null,
      rows.length ? el('div', { class: 'stats' }, ...rows) : null,
    ], [
      button('Replay', () => showGame(level), 'orange'),
      next ? button('Next ▸', () => { showMap(); showIntro(next); })
        : button('Map', showMap),
    ], { host: 'cheer', confetti: true });
  } else {
    const why = r.goal === 'jelly' ? `${r.jellyLeft} foam left to clear`
      : r.goal === 'ingredients' ? `${r.ingredientsLeft} friend${r.ingredientsLeft === 1 ? '' : 's'} still up top`
      : `Needed ${fmt(r.target)} points`;
    play('lose');
    openDialog(`Level ${level.id}`, [
      el('div', { class: 'big-text toon', text: 'Out of moves!' }),
      el('p', { class: 'goal-text', text: why }),
      el('p', { class: 'muted' }, 'Score ', el('strong', { text: fmt(r.score) })),
    ], [
      button('Map', showMap, 'orange'),
      button('Try again', () => showGame(level)),
    ], { host: 'worried' });
  }
}

// Tick a number up to `to` over about a second.
function countUp(node, to) {
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / 1100);
    node.textContent = fmt(Math.round(to * (1 - (1 - k) ** 3)));
    if (k < 1) {
      play('tick');
      requestAnimationFrame(step);
    }
  };
  requestAnimationFrame(step);
}

function showPause() {
  openDialog('Paused', [
    el('p', { class: 'goal-text' }, goalIcon(current.goal.type), goalText(current)),
  ], [
    button('Resume', closeDialog),
    button('Restart', () => { if (game && !game.busy) showGame(current); }, 'orange'),
    button('Settings', () => showSettings(showPause), 'orange'),
    button('Quit to map', showMap, 'orange'),
  ], { host: 'idle', stack: true });
}

// Sound, music, voice and haptics switches. `back` reopens whatever came before.
function showSettings(back = closeDialog) {
  const toggle = (key, name, note) => {
    const btn = el('button', { class: 'toggle', type: 'button', 'aria-pressed': String(getSetting(key)) },
      el('span', { class: 'name' }, name, note ? el('small', { text: note }) : null),
      el('span', { class: 'knob', 'aria-hidden': 'true' }));
    btn.addEventListener('click', () => {
      const on = !getSetting(key);
      setSetting(key, on);
      btn.setAttribute('aria-pressed', String(on));
      tapFeedback();
    });
    return btn;
  };
  openDialog('Settings', [
    toggle('sfx', 'Sound effects'),
    toggle('music', 'Music'),
    toggle('voice', 'Announcer voice', 'The phone\u2019s own voice; may speak even on silent'),
    toggle('haptics', 'Haptics', 'On iPhone, a light tap (iOS 18 or newer)'),
  ], [button('Done', back)], { host: 'idle', stack: true });
}

// ---- the game --------------------------------------------------------------

let game = null;
function getGame() {
  game ??= new Game($('board'), {
    onChange: updateHud,
    onBanner: showBanner,
    onCallout: callout,
    onEnd: (r) => setTimeout(() => showResult(r), 400),
  });
  window.jankyCrush = game; // handy from the Safari Web Inspector and the smoke tests
  return game;
}

function updateHud(h) {
  const level = current;
  $('moves').textContent = h.moves;
  $('moves').parentElement.classList.toggle('low', h.moves <= 3 && h.moves > 0 && !game?.over);
  $('score').textContent = fmt(h.score);
  const pct = Math.min(100, (h.score / level.stars[2]) * 100);
  $('meter-fill').style.width = `${pct}%`;
  $('meter').setAttribute('aria-valuenow', String(Math.round(pct)));
  [...document.querySelectorAll('.meter-star')].forEach((s, i) => s.classList.toggle('on', i < h.stars));
  const icon = $('goal-icon');
  if (icon.dataset.type !== h.goal) {
    icon.dataset.type = h.goal;
    icon.className = `goal-icon ${h.goal === 'score' ? 'score' : h.goal}`;
    icon.innerHTML = h.goal === 'ingredients' ? ducky() : ''; // our own SVG art
  }
  if (h.goal === 'jelly') {
    $('goal-label').textContent = 'Clear the foam';
    $('goal-value').textContent = `${h.jellyLeft} left`;
  } else if (h.goal === 'ingredients') {
    $('goal-label').textContent = 'Bring them down';
    $('goal-value').textContent = `${h.ingredientsLeft} left`;
  } else {
    $('goal-label').textContent = 'Score to win';
    $('goal-value').textContent = fmt(level.stars[0]);
  }
  if (hostPose !== 'cheer') setHost(h.moves <= 3 && h.moves > 0 && !game?.over ? 'worried' : 'idle');
}

$('pause').addEventListener('click', () => {
  if (!current) return;
  tapFeedback();
  showPause();
});
$('settings').addEventListener('click', () => {
  tapFeedback();
  showSettings();
});

// iPhones only allow sound after a tap, so wake the audio on the first one
// (and after the app comes back from the background).
const wakeSound = () => { unlockAudio(); primeVoice(); };
document.addEventListener('pointerdown', wakeSound, { capture: true });
document.addEventListener('touchend', wakeSound, { capture: true });

buildWorld($('world'));

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    game?.resize();
    if (!$('map-screen').hidden) showMap();
  }, 100);
});

// Stop iOS pinch-zoom and double-tap zoom from fighting the board.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js');
}

showMap();
