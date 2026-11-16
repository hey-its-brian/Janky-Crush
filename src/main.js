import { Game } from './game.js';
import { LEVELS } from './levels.js';
import { Progress, PRICES, EXTRA_MOVES, BOOSTERS, DAILY_COINS, MAX_LIVES, SPIN_COST } from './save.js';
import { buildWorld, setWorldZone } from './ui/world.js';
import { renderMap, zoneNumber } from './ui/map.js';
import { capy } from './art/capy.js';
import { steam } from './art/scene.js';
import { specialIcon, pieceIcon } from './art/pieces.js';
import { coin, heart, gift, lifeRefill, wheelIcon, BOOSTER_ICONS, BOOSTER_NAMES, BOOSTER_INFO } from './art/icons.js';
import { unlockAudio, play } from './audio/sfx.js';
import { playMusic, songFor } from './audio/music.js';
import { haptic, tactile } from './audio/haptics.js';
import { isNative } from './native.js';
import { cloudLoad, cloudStore } from './cloud.js';
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
    else if (k === 'svg') node.innerHTML = v; // our own art, never user input only
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

const icon = (svg, cls = 'icon') => el('i', { class: cls, svg, 'aria-hidden': 'true' });
const coinTag = (n) => el('span', { class: 'balance' }, icon(coin()), fmt(n));
const clock = (ms) => {
  const t = Math.ceil(ms / 1000);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

// The scene on the start screen: the host sits in the hot spring, with
// ripples around it and steam above the water. Built once.
function buildTitleStage() {
  const stage = $('title-stage');
  if (stage.firstChild) return;
  const wisps = [[30, 55.5, 0], [43, 53.5, 1.7], [62, 54.5, 2.9], [70, 56.5, 0.9]]
    .map(([x, y, d]) => `<div class="sprite steam" style="left:${x}%;top:${y}%;animation-delay:-${d}s">${steam()}</div>`).join('');
  // Our own art, never user input.
  stage.innerHTML = `<div class="title-ripple"></div><div class="title-ripple late"></div>` +
    `<div class="title-host">${capy('idle')}</div><div class="title-water"></div>${wisps}`;
}

// The start screen: two save files, Normal and Easy.
function showTitle() {
  game?.stop();
  closeDialog();
  $('game-screen').hidden = true;
  $('map-screen').hidden = true;
  $('world').hidden = true;
  $('title-screen').hidden = false;
  buildTitleStage();
  playMusic(0);
  const card = (mode, name, tag) => {
    const slot = progress.slotInfo(mode);
    const head = el('div', { class: 'head' }, el('h2', { text: name }), el('span', { class: 'tag', text: tag }));
    if (!slot) {
      return el('div', { class: 'panel save-card' }, head,
        el('div', { class: 'facts new', text: 'Level 1' }),
        button('New game', () => { progress.use(mode); showMap(); }));
    }
    const level = Math.min(progress.unlocked(slot), LEVELS.length);
    const facts = el('div', { class: 'facts' },
      el('span', { text: `Level ${level}` }),
      el('span', {}, el('i', { class: 'star-icon', style: 'width:22px;height:22px' }), String(progress.totalStars(slot))),
      el('span', {}, icon(coin()), fmt(slot.coins)));
    const over = el('button', { class: 'link-btn', type: 'button', text: 'Start over' });
    over.addEventListener('click', () => { tapFeedback(); confirmStartOver(mode, name); });
    return el('div', { class: 'panel save-card' }, head, facts,
      button('Play', () => { progress.use(mode); showMap(); }), over);
  };
  $('save-cards').replaceChildren(
    card('normal', 'Normal', 'Lives refill over time'),
    card('easy', 'Easy', 'Unlimited lives'));
}

function confirmStartOver(mode, name) {
  openDialog('Start over?', [
    el('p', { class: 'goal-text', text: `This wipes the ${name} save: levels, stars, coins and boosters.` }),
    el('p', { class: 'muted', text: 'The other save file isn\u2019t touched.' }),
  ], [
    button('Keep it', showTitle, 'orange'),
    button('Start over', () => { progress.startOver(mode); showTitle(); }),
  ], { host: 'worried' });
}

// The last level the map showed as current, per save, so a win can be
// shown as the host travelling on to the next one.
const lastCurrent = {};

function showMap(then = null) {
  game?.stop();
  closeDialog();
  $('title-screen').hidden = true;
  $('game-screen').hidden = true;
  $('world').hidden = true;
  $('map-screen').hidden = false;
  playMusic(0);
  const before = lastCurrent[progress.active];
  const { current: next, y, fromY } = renderMap($('map'), LEVELS, progress, (level) => { tapFeedback(); showIntro(level); }, { from: before });
  lastCurrent[progress.active] = next.id;
  const moved = before && before < next.id;
  if (moved) {
    play('sparkle', { kind: 'stripe' });
    setTimeout(() => play('star', { i: 2 }), 1000);
  }
  $('total-stars').textContent = String(progress.totalStars());
  $('play-btn').textContent = `Play ${next.id}`;
  $('play-btn').onclick = () => { tapFeedback(); showIntro(next); };
  updateTopbar();
  // Bring the next level to play into view, low on the screen; after a
  // win, follow the host up from the level just beaten.
  const scroller = $('map-scroll');
  const target = Math.max(0, y - scroller.clientHeight * 0.6);
  if (moved && fromY != null) {
    scroller.scrollTop = Math.max(0, fromY - scroller.clientHeight * 0.6);
    setTimeout(() => scroller.scrollTo({ top: target, behavior: 'smooth' }), 150);
  } else {
    scroller.scrollTop = target;
  }
  if (then) setTimeout(() => $('dialog').hidden && then(), moved ? 1700 : 0);
  if (progress.claimDaily()) {
    updateTopbar();
    play('coin');
    openDialog('Daily bonus!', [
      icon(coin(), 'icon big'),
      el('div', { class: 'final toon', text: `+${DAILY_COINS}` }),
      el('p', { class: 'muted', text: 'Coins for coming back today.' }),
    ], [button('Thanks!', closeDialog)], { host: 'cheer', confetti: true });
  }
}

// Lives and coins along the top of the map.
function updateTopbar() {
  if (!progress.active) return;
  $('coins-count').textContent = fmt(progress.coins);
  $('spin-points').textContent = String(progress.spins);
  $('wheel-btn').classList.toggle('ready', progress.spins >= SPIN_COST.small);
  if (progress.easy) {
    $('lives-count').textContent = '\u221e';
    $('lives-timer').textContent = 'Easy';
    return;
  }
  const lives = progress.lives();
  $('lives-count').textContent = String(lives);
  $('lives-timer').textContent = lives >= MAX_LIVES ? 'Full' : clock(progress.nextLifeIn());
}
setInterval(() => {
  if (!$('map-screen').hidden) updateTopbar();
  if (livesDialogOpen) livesDialogOpen();
}, 1000);

function showGame(level) {
  current = level;
  closeDialog();
  $('title-screen').hidden = true;
  $('map-screen').hidden = true;
  setWorldZone($('world'), zoneNumber(level.id));
  $('world').hidden = false;
  $('game-screen').hidden = false;
  // Star marks along the meter at each threshold (the third sits at the end).
  const top = level.stars[2];
  [...document.querySelectorAll('.meter-star')].forEach((mark, i) => {
    mark.style.left = `${Math.min(96, (level.stars[i] / top) * 100)}%`;
  });
  setHost('idle');
  $('host-bubble').hidden = true;
  playMusic(songFor(level.id));
  getGame().start(level);
  renderBoosters();
}

// ---- the host and callouts ---------------------------------------------------

let hostPose = null;
let hostTimer;
function setHost(pose) {
  if (pose === hostPose) return;
  hostPose = pose;
  $('host').innerHTML = capy(pose); // our own art, never user input
}

// A hint in the host's speech bubble that stays until cleared.
function say(text) {
  clearTimeout(hostTimer);
  const bubble = $('host-bubble');
  bubble.textContent = text;
  bubble.hidden = !text;
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
const CHEER_TIER = { 'Zesty!': 1, 'Juiced!': 2, 'Fresh Squeezed!': 3, 'Fruit Punch!': 4 };

function callout(text) {
  play('cheer', { tier: CHEER_TIER[text] ?? 1 });
  haptic(1);
  const c = $('callout');
  c.textContent = text;
  // The long words are smaller, so each one fits on one line.
  c.style.fontSize = text.length > 12 ? '42px' : text.length > 8 ? '52px' : '';
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

// "a", "a and b", "a, b and c".
const listing = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

const FRUIT_NAMES = { r: 'strawberries', o: 'oranges', y: 'star fruit', g: 'pears', b: 'blueberries', p: 'grapes' };

// Which blockers a level has, in the order they first appear.
function blockerKinds(level) {
  const kinds = [];
  for (const ch of level.layout.join('')) {
    const k = 'kK'.includes(ch) ? 'coconut' : 'mM'.includes(ch) ? 'mochi' : ch === 'u' ? 'gummy' : 'jJ'.includes(ch) ? 'jam' : null;
    if (k && !kinds.includes(k)) kinds.push(k);
  }
  for (const d of level.dispensers ?? []) if (d.kind === 'gummy' && !kinds.includes('gummy')) kinds.push('gummy');
  return kinds;
}
const BLOCKER_ART = { coconut: () => pieceIcon('coco2'), mochi: () => pieceIcon('mochi2'), gummy: () => pieceIcon('gummy'), jam: () => pieceIcon('jam') };
const BLOCKER_GOAL = { coconut: 'Crack open every coconut', mochi: 'Squish every mochi', gummy: 'Pop every gummy cube', jam: 'Clear all the jam' };

function goalText(level) {
  switch (level.goal.type) {
    case 'jelly':
      return 'Clear all the bath foam';
    case 'ingredients':
      return `Bring ${level.goal.count} friends down to the spring`;
    case 'blockers': {
      const kinds = blockerKinds(level);
      return kinds.length === 1 ? BLOCKER_GOAL[kinds[0]] : 'Clear every blocker';
    }
    case 'collect':
      return `Blend a smoothie: ${listing(Object.entries(level.goal.targets).map(([c, n]) => `${n} ${FRUIT_NAMES[c]}`))}`;
    default:
      return `Score ${fmt(level.stars[0])} points`;
  }
}

function goalIcon(type, level = current) {
  const icon = el('i', { class: `goal-icon ${type}`, 'aria-hidden': 'true' });
  // Our own SVG art.
  if (type === 'ingredients') icon.innerHTML = pieceIcon('duck');
  if (type === 'blockers') icon.innerHTML = BLOCKER_ART[blockerKinds(level)[0] ?? 'coconut']();
  if (type === 'collect') icon.innerHTML = pieceIcon(Object.keys(level.goal.targets)[0]);
  return icon;
}

function openDialog(title, body, actions, { host = null, confetti = false, stack = false } = {}) {
  livesDialogOpen = null;
  $('dialog-title').textContent = title;
  $('dialog-body').replaceChildren(...body.filter(Boolean));
  $('dialog-actions').replaceChildren(...actions);
  $('dialog-actions').classList.toggle('stack', stack);
  $('dialog-host').innerHTML = host ? capy(host) : ''; // our own art, never user input
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
  livesDialogOpen = null;
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
  if (progress.lives() <= 0) {
    showLives(level);
    return;
  }
  const best = progress.level(level.id);
  openDialog(`Level ${level.id}`, [
    bigStars(best.stars),
    el('p', { class: 'goal-text' }, goalIcon(level.goal.type, level), goalText(level)),
    el('p', { class: 'muted', text: `in ${level.moves} moves` }),
    level.tip ? el('p', { class: 'tip', text: level.tip }) : null,
    best.best ? el('p', { class: 'muted', text: `Best score ${fmt(best.best)}` }) : null,
  ], [
    button('Back', closeDialog, 'orange'),
    button('Play!', () => showGame(level)),
  ], { host: 'idle' });
}

// What was still missing when a level was lost.
function goalShortfall(r) {
  switch (r.goal) {
    case 'jelly': return `${r.jellyLeft} foam left to clear`;
    case 'ingredients': return `${r.ingredientsLeft} friend${r.ingredientsLeft === 1 ? '' : 's'} still up top`;
    case 'blockers': return `${r.blockersLeft} blocker${r.blockersLeft === 1 ? '' : 's'} still in the way`;
    case 'collect':
      return `Still needed ${Object.entries(r.collectLeft).filter(([, n]) => n).map(([c, n]) => `${n} ${FRUIT_NAMES[c]}`).join(', ')}`;
    default: return `Needed ${fmt(r.target)} points`;
  }
}

function statRow(name, value, icon = null) {
  return el('div', { class: 'stat' }, icon, el('span', { class: 'name', text: name }), value);
}

function showResult(r) {
  const level = current;
  if (r.won) {
    const before = progress.level(level.id).best;
    const coins = progress.recordWin(level.id, r.stars, r.score, r.movesLeft);
    const next = LEVELS.find((l) => l.id === level.id + 1);
    const s = r.stats;
    const chip = (svg, n) => el('span', { class: 'chip' }, el('span', { svg }), `×${n}`);
    const specials = el('span', { class: 'val' },
      s.striped ? chip(specialIcon('r', 'striped'), s.striped) : null,
      s.wrapped ? chip(specialIcon('o', 'wrapped'), s.wrapped) : null,
      s.bomb ? chip(pieceIcon('bomb'), s.bomb) : null);
    const rows = [
      s.striped + s.wrapped + s.bomb ? statRow('Specials made', specials) : null,
      s.bestCascade > 1 ? statRow('Biggest chain', el('span', { class: 'val', text: `×${s.bestCascade}` })) : null,
      s.foamCleared ? statRow('Foam cleared', el('span', { class: 'val', text: fmt(s.foamCleared) }), el('i', { class: 'foam-icon goal-icon', style: 'width:30px;height:30px' })) : null,
      s.blockers ? statRow('Blockers cleared', el('span', { class: 'val', text: String(s.blockers) }), el('i', { class: 'goal-icon', svg: pieceIcon('coco1'), style: 'width:32px;height:32px' })) : null,
      r.collected ? statRow('Friends rescued', el('span', { class: 'val', text: String(r.collected) }), el('i', { class: 'goal-icon', svg: pieceIcon('duck'), style: 'width:32px;height:32px' })) : null,
      s.defused ? statRow('Timers stopped', el('span', { class: 'val', text: String(s.defused) })) : null,
      s.bonus ? statRow('Leftover moves bonus', el('span', { class: 'val', text: `+${fmt(s.bonus)}` })) : null,
      statRow('Coins earned', el('span', { class: 'val' }, icon(coin()), `+${coins.total}`)),
      coins.spin ? statRow('Spin point', el('span', { class: 'val' }, icon(wheelIcon()), `+${coins.spin}`)) : null,
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
      next ? button('Next ▸', () => showMap(() => showIntro(next)))
        : button('Map', showMap),
    ], { host: 'cheer', confetti: true });
  } else {
    const why = goalShortfall(r);
    play('lose');
    progress.loseLife();
    const lives = progress.lives();
    openDialog(`Level ${level.id}`, [
      el('div', { class: 'big-text toon', text: r.exploded ? 'Boom!' : 'Out of moves!' }),
      el('p', { class: 'goal-text', text: r.exploded ? 'A timer fruit got to zero. Match each one before its count runs out.' : why }),
      el('p', { class: 'muted' }, 'Score ', el('strong', { text: fmt(r.score) })),
      progress.easy ? null : el('p', { class: 'goal-text' }, icon(heart()),
        lives > 0 ? `Lost a life \u00b7 ${lives} left` : 'That was your last life'),
    ], [
      button('Map', showMap, 'orange'),
      button('Try again', () => showIntro(level)),
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
    button('Restart', () => leaveLevel(() => showIntro(current)), 'orange'),
    button('Settings', () => showSettings(showPause), 'orange'),
    button('Quit to map', () => leaveLevel(showMap), 'orange'),
  ], { host: 'idle', stack: true });
}

// Leaving a level after making a move counts as a loss (like the
// original), so on Normal it asks first.
function leaveLevel(then) {
  if (!game || game.busy) return;
  if (progress.easy || !game.started || game.over) {
    then();
    return;
  }
  openDialog('Give up?', [
    el('p', { class: 'goal-text' }, icon(heart()), 'You\u2019ll lose a life.'),
  ], [
    button('Keep playing', closeDialog),
    button('Give up', () => { game.stop(); progress.loseLife(); then(); }, 'orange'),
  ], { host: 'worried' });
}

// ---- lives, coins and the shop ---------------------------------------------------

let livesDialogOpen = null; // refreshes the countdown while the dialog is up

// Lives: how many, when the next one comes, and a coin refill. With a
// `level`, it's the "no lives left" stop before playing.
function showLives(level = null) {
  if (progress.easy) {
    openDialog('Lives', [
      icon(heart(), 'icon big'),
      el('p', { class: 'goal-text', text: 'Easy mode has unlimited lives.' }),
    ], [button('OK', closeDialog)], { host: 'cheer' });
    return;
  }
  const count = el('div', { class: 'final toon' });
  const note = el('p', { class: 'muted' });
  const refresh = () => {
    const lives = progress.lives();
    count.textContent = String(lives);
    note.textContent = lives >= MAX_LIVES ? 'All full!' : `Next life in ${clock(progress.nextLifeIn())}`;
    if (level && lives > 0) showIntro(level);
  };
  const full = progress.lives() >= MAX_LIVES;
  const refill = priceButton('Refill', PRICES.lives, () => {
    if (!progress.refillLives()) return;
    play('coin');
    updateTopbar();
    if (level) showIntro(level);
    else showLives();
  });
  // A life refill from the prize wheel, if there is one.
  const kept = progress.lifeRefills;
  const useKept = button(`Use life refill (${kept} left)`, () => {
    if (!progress.useLifeRefill()) return;
    play('star', { i: 2 });
    updateTopbar();
    if (level) showIntro(level);
    else showLives();
  });
  openDialog(level ? 'No lives left' : 'Lives', [
    icon(heart(), 'icon big'),
    count,
    note,
    el('p', { class: 'muted', text: `One life comes back every 30 minutes, up to ${MAX_LIVES}.` }),
    kept ? el('p', { class: 'goal-text' }, icon(lifeRefill()), `Life refills: ${kept}`) : null,
    coinTag(progress.coins),
  ], full ? [button('OK', closeDialog)] : [kept ? useKept : null, refill, button(level ? 'Wait' : 'OK', closeDialog, 'orange')].filter(Boolean),
  { host: level ? 'worried' : 'idle', stack: !full && kept > 0 });
  refresh();
  livesDialogOpen = refresh;
}

// A green button with a coin price; greyed out if you can't afford it.
function priceButton(text, price, onBuy) {
  const btn = el('button', { class: 'btn green toon price-btn', type: 'button' }, text, icon(coin()), String(price));
  if (progress.coins < price) btn.disabled = true;
  btn.addEventListener('click', () => { tapFeedback(); onBuy(); });
  return btn;
}

// The shop: boosters to keep for later.
function showShop() {
  const rows = BOOSTERS.map((name) => el('div', { class: 'shop-row' },
    icon(BOOSTER_ICONS[name]()),
    el('span', { class: 'what' }, el('b', { text: `${BOOSTER_NAMES[name]} \u00d7${progress.boosters(name)}` }), el('small', { text: BOOSTER_INFO[name] })),
    priceButton('', PRICES[name], () => {
      if (progress.buyBooster(name)) play('coin');
      updateTopbar();
      showShop();
    })));
  openDialog('Shop', [
    coinTag(progress.coins),
    el('div', { class: 'shop' }, ...rows),
    el('p', { class: 'muted', text: 'Earn coins by winning levels, new stars, leftover moves and a daily bonus.' }),
  ], [button('Done', closeDialog)], { host: 'cheer' });
}

// ---- the prize wheel ------------------------------------------------------------------

const WHEEL_COLORS = ['#ffd1e6', '#fff1b8', '#c9f1ff', '#dcf8c6'];
const prizeIcon = (p) => (p.type === 'booster' ? BOOSTER_ICONS[p.name]() : p.type === 'bundle' ? gift() : p.type === 'life' ? lifeRefill() : coin());
const prizeLabel = (p) => (p.type === 'coins' ? String(p.n) : p.type === 'bundle' ? `\u00d7${BOOSTERS.length * p.n}` : `\u00d7${p.n}`);
const prizeName = (p) => (p.type === 'booster' ? `${BOOSTER_NAMES[p.name]} \u00d7${p.n}`
  : p.type === 'bundle' ? 'A bundle of power-ups'
  : p.type === 'life' ? 'A life refill'
  : `${p.n} coins`);
const prizeNote = (p) => (p.type === 'booster' ? BOOSTER_INFO[p.name]
  : p.type === 'bundle' ? `One of each: ${listing(BOOSTERS.map((b) => BOOSTER_NAMES[b]))}.`
  : p.type === 'life' ? 'Keep it for when you run out of lives. It brings them all back.'
  : 'Spend them in the shop.');

// The wheel: eight slices of the same size, slice 0 at the top.
function wheelArt(prizes) {
  const step = 360 / prizes.length;
  const stops = prizes.map((_, i) => `${WHEEL_COLORS[i % WHEEL_COLORS.length]} ${i * step}deg ${(i + 1) * step}deg`).join(', ');
  const wheel = el('div', { class: 'wheel', style: `background:conic-gradient(from ${-step / 2}deg, ${stops})` },
    ...prizes.map((p, i) => el('div', { class: 'slice', style: `transform:rotate(${i * step}deg)` },
      el('span', { class: p.type === 'bundle' || p.type === 'life' ? 'top' : '' }, icon(prizeIcon(p)), el('b', { text: prizeLabel(p) })))));
  return { wheel, wrap: el('div', { class: 'wheel-wrap' }, wheel, el('i', { class: 'wheel-hub' }), el('i', { class: 'wheel-pointer' })) };
}

let spinning = false;

// The prize wheel dialog. `kind` is 'small' (5 points) or 'grand' (10).
function showWheel(kind = 'small') {
  if (spinning) return;
  const prizes = progress.wheel(kind);
  const { wheel, wrap } = wheelArt(prizes);
  const tab = (k, text) => {
    const b = el('button', { class: `tab${k === kind ? ' on' : ''}`, type: 'button', text });
    b.addEventListener('click', () => { tapFeedback(); showWheel(k); });
    return b;
  };
  const cost = SPIN_COST[kind];
  const spin = button(`Spin \u00b7 ${cost}`, async () => {
    const won = progress.spin(kind);
    if (!won) return;
    spinning = true;
    for (const b of $('dialog').querySelectorAll('button')) b.disabled = true;
    points.lastChild.textContent = ` Spin points: ${progress.spins}`;
    updateTopbar();
    await turnWheel(wheel, won.index, prizes.length);
    spinning = false;
    showPrize(won.prize, kind);
  });
  if (progress.spins < cost) spin.disabled = true;
  const points = el('p', { class: 'goal-text' }, icon(wheelIcon()), ` Spin points: ${progress.spins}`);
  openDialog('Prize wheel', [
    el('div', { class: 'tabs' }, tab('small', `${SPIN_COST.small} points`), tab('grand', `${SPIN_COST.grand} points`)),
    wrap,
    points,
    el('p', { class: 'muted', text: kind === 'small'
      ? 'Beat a level for the first time to get a spin point. Save 10 points for the grand wheel: its prizes are bigger.'
      : 'The grand wheel: two bundles and more coins.' }),
  ], [button('Close', closeDialog, 'orange'), spin], { host: 'cheer' });
}

// Turn the wheel until slice `index` is under the pointer: fast, then
// slower and slower, with a tick at each slice that goes by.
function turnWheel(wheel, index, n) {
  const step = 360 / n;
  const end = 360 * 5 - index * step + (Math.random() - 0.5) * step * 0.6;
  const t0 = performance.now(), duration = 4200;
  let last = 0;
  return new Promise((resolve) => {
    const frame = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      const angle = end * (1 - (1 - t) ** 4);
      wheel.style.transform = `rotate(${angle}deg)`;
      const passed = Math.floor((angle + step / 2) / step);
      if (passed !== last) {
        last = passed;
        play('tick');
        haptic(1);
      }
      if (t < 1) requestAnimationFrame(frame);
      else setTimeout(resolve, 450);
    };
    requestAnimationFrame(frame);
  });
}

function showPrize(prize, kind) {
  play('win');
  updateTopbar();
  openDialog('You won!', [
    icon(prizeIcon(prize), 'icon big'),
    el('div', { class: 'big-text toon', text: prizeName(prize) }),
    el('p', { class: 'goal-text', text: prizeNote(prize) }),
  ], [button('Wheel', () => showWheel(kind), 'orange'), button('Great!', closeDialog)], { host: 'cheer', confetti: true });
}

// ---- boosters in a level -----------------------------------------------------------

const AIM_HINT = { smash: 'Tap a fruit to smash!', switch: 'Swap any two fruits!', sweep: 'Tap to clear a row and a column!', pick: 'Tap a fruit to take all of its kind!' };

function renderBoosters() {
  const bar = $('boosters');
  bar.replaceChildren(...BOOSTERS.map((name) => {
    const have = progress.boosters(name);
    const btn = el('button', { class: `booster${game?.armed === name ? ' armed' : ''}`, type: 'button', 'aria-label': `${BOOSTER_NAMES[name]}, ${have} left`, svg: BOOSTER_ICONS[name]() });
    btn.append(have > 0
      ? el('span', { class: 'count', text: String(have) })
      : el('span', { class: 'count buy' }, icon(coin()), String(PRICES[name])));
    btn.addEventListener('click', () => { tapFeedback(); pickBooster(name); });
    return btn;
  }));
}

function pickBooster(name) {
  if (!game || game.busy || game.over) return;
  if (game.armed === name) {
    game.disarm();
    say('');
    renderBoosters();
    return;
  }
  if (progress.boosters(name) <= 0) {
    openDialog(BOOSTER_NAMES[name], [
      icon(BOOSTER_ICONS[name](), 'icon big'),
      el('p', { class: 'goal-text', text: BOOSTER_INFO[name] }),
      coinTag(progress.coins),
    ], [
      button('Not now', closeDialog, 'orange'),
      priceButton('Buy', PRICES[name], () => {
        if (!progress.buyBooster(name)) return;
        play('coin');
        closeDialog();
        pickBooster(name);
      }),
    ], { host: 'idle' });
    return;
  }
  game.disarm();
  if (game.arm(name) && name !== 'shuffle') say(AIM_HINT[name]);
  renderBoosters();
}

// Out of moves on a level you haven't won: offer more for coins.
let offering = false; // the +5 moves question is up; Pause waits for it

function offerMoves() {
  offering = true;
  return new Promise((done) => {
    const resolve = (n) => { offering = false; done(n); };
    const s = game.state;
    const why = s.goal.type === 'jelly' ? `${s.jellyLeft()} foam left to clear`
      : s.goal.type === 'ingredients' ? `${s.ingredientsLeft()} still to bring down`
      : s.goal.type === 'blockers' ? `${s.blockersLeft()} blocker${s.blockersLeft() === 1 ? '' : 's'} to clear`
      : s.goal.type === 'collect' ? `${Object.entries(s.collectLeft()).filter(([, n]) => n).map(([c, n]) => `${n} ${FRUIT_NAMES[c]}`).join(', ')} to go`
      : `${fmt(s.level.stars[0] - s.score)} points to go`;
    play('boing');
    openDialog('Out of moves!', [
      el('div', { class: 'big-text toon', text: `+${EXTRA_MOVES} moves?` }),
      el('p', { class: 'goal-text' }, goalIcon(s.goal.type), why),
      coinTag(progress.coins),
    ], [
      button('Give up', () => { closeDialog(); resolve(0); }, 'orange'),
      priceButton(`+${EXTRA_MOVES}`, PRICES.moves, () => {
        if (!progress.spend(PRICES.moves)) return;
        play('coin');
        closeDialog();
        resolve(EXTRA_MOVES);
      }),
    ], { host: 'worried' });
  });
}

// Sound, music and haptics switches. `back` reopens whatever came before.
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
    toggle('haptics', 'Haptics', isNative ? 'A tap that you feel for each match' : 'On iPhone, a light tick when you tap'),
  ], [button('Done', back)], { host: 'idle', stack: true });
}

// ---- the game --------------------------------------------------------------

let game = null;
function getGame() {
  game ??= new Game($('board'), {
    onChange: updateHud,
    onBanner: showBanner,
    onCallout: callout,
    onEnd: (r) => setTimeout(() => showResult(r), 250),
    onOutOfMoves: offerMoves,
    onCleared: flyToBlender,
    onBooster: (name) => {
      progress.useBooster(name);
      say('');
      renderBoosters();
    },
  });
  window.jankyCrush = game; // handy from the Safari Web Inspector and the smoke tests
  return game;
}

// ---- the smoothie blender (collect goals) ----------------------------------------------

const FRUIT_JUICE = { r: '#ff3d5a', o: '#ff9a1f', y: '#ffe14d', g: '#7fd640', b: '#4a7dff', p: '#9b4dff' };
let flying = 0;

// The jar fills in layers, one per fruit, as each is gathered. When the
// recipe is done the blades whirl and it turns into a smoothie.
function fillBlender(level, left) {
  const targets = level.goal.targets;
  const total = Object.values(targets).reduce((a, b) => a + b, 0);
  for (const layer of $('blender-fill').children) {
    const c = layer.dataset.color;
    layer.style.height = `${((targets[c] - (left[c] ?? 0)) / total) * 100}%`;
  }
  const done = Object.values(left).every((n) => n === 0);
  const blender = $('blender');
  if (done && !blender.classList.contains('done')) {
    blender.classList.add('done', 'whir');
    play('blend');
    haptic(2);
  }
}

// A popped fruit flies up into the blender (at most a dozen at once).
function flyToBlender({ color, x, y }) {
  const s = game?.state;
  if (!s || s.goal.type !== 'collect' || !(color in s.goal.targets) || flying >= 12) return;
  const from = $('board').getBoundingClientRect();
  const to = $('blender').querySelector('.jar').getBoundingClientRect();
  const bit = el('div', { class: 'fly-fruit', svg: pieceIcon(color) });
  bit.style.left = `${from.left + x - 17}px`;
  bit.style.top = `${from.top + y - 17}px`;
  document.body.append(bit);
  flying++;
  const dx = to.left + to.width / 2 - (from.left + x), dy = to.top + to.height / 2 - (from.top + y);
  const anim = bit.animate([
    { transform: 'translate(0, 0) scale(1)' },
    { transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 40}px) scale(1.15)`, offset: 0.35 },
    { transform: `translate(${dx}px, ${dy}px) scale(.45)` },
  ], { duration: 520 + Math.random() * 160, easing: 'ease-in' });
  anim.onfinish = () => {
    bit.remove();
    flying--;
    const blender = $('blender');
    blender.classList.remove('gulp');
    void blender.offsetWidth;
    blender.classList.add('gulp');
    play('foam');
  };
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
  const goalKey = `${level.id}:${h.goal}`;
  if (icon.dataset.type !== goalKey) {
    icon.dataset.type = goalKey;
    icon.className = `goal-icon ${h.goal}`;
    icon.innerHTML = h.goal === 'ingredients' ? pieceIcon('duck') : h.goal === 'blockers' ? BLOCKER_ART[blockerKinds(level)[0] ?? 'coconut']() : ''; // our own art, never user input
    $('blender').classList.remove('done', 'whir');
    $('blender-fill').replaceChildren(...Object.keys(h.collectLeft).map((c) => el('i', { 'data-color': c, style: `background:${FRUIT_JUICE[c]}` })));
    // Collect goals list each fruit with its own count.
    $('goal-fruits').replaceChildren(...Object.keys(h.collectLeft).map((c) =>
      el('span', { class: 'goal-fruit', 'data-color': c }, el('i', { class: 'goal-icon small', svg: pieceIcon(c) }), el('b', { class: 'count' }))));
  }
  const collecting = h.goal === 'collect';
  $('goal-fruits').hidden = !collecting;
  $('blender').hidden = !collecting;
  if (collecting) fillBlender(level, h.collectLeft);
  $('goal-fruits').classList.toggle('many', Object.keys(h.collectLeft).length > 2);
  icon.hidden = collecting;
  $('goal-single').hidden = collecting;
  if (collecting) {
    for (const span of $('goal-fruits').children) {
      const left = h.collectLeft[span.dataset.color];
      span.querySelector('b').textContent = left > 0 ? String(left) : '\u2713';
      span.classList.toggle('done', left === 0);
    }
  } else if (h.goal === 'blockers') {
    $('goal-label').textContent = 'Clear blockers';
    $('goal-value').textContent = `${h.blockersLeft} left`;
  } else if (h.goal === 'jelly') {
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
  if (!current || offering) return;
  tapFeedback();
  showPause();
});
$('settings').addEventListener('click', () => {
  tapFeedback();
  showSettings();
});
$('home').addEventListener('click', () => { tapFeedback(); showTitle(); });
$('lives-pill').addEventListener('click', () => { tapFeedback(); showLives(); });
$('coins-pill').addEventListener('click', () => { tapFeedback(); showShop(); });
$('heart-icon').innerHTML = heart(); // our own art, never user input
$('top-avatar-art').innerHTML = capy('idle');
$('coin-icon').innerHTML = coin();
$('wheel-icon').innerHTML = wheelIcon();
$('wheel-btn').addEventListener('click', () => { tapFeedback(); showWheel(); });

// iPhones only allow sound after a tap, so wake the audio on the first one
// (and after the app comes back from the background).
const wakeSound = () => unlockAudio();
document.addEventListener('pointerdown', wakeSound, { capture: true });
document.addEventListener('touchend', wakeSound, { capture: true });
document.addEventListener('click', wakeSound, { capture: true });

buildWorld($('world'));
tactile($('board'));

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    game?.resize();
    if (!$('map-screen').hidden && $('dialog').hidden) showMap();
  }, 100);
});

// Stop iOS pinch-zoom and double-tap zoom from fighting the board.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// ---- iCloud save (the native app) --------------------------------------------------

// Bring in the iCloud copy of the save, merge it with the one on this
// phone, and send the result back. Runs at the start and each time the
// app comes back to the front, but not in the middle of a level.
async function syncCloud() {
  const { data, available } = await cloudLoad();
  if (!available) {
    // Say it one time: the save is on this iPhone only.
    if (!localStorage.getItem('yuzu-springs:no-icloud') && !$('title-screen').hidden && $('dialog').hidden) {
      localStorage.setItem('yuzu-springs:no-icloud', '1');
      openDialog('iCloud is off', [
        el('p', { class: 'goal-text', text: 'Your progress is saved on this iPhone only. Sign in to iCloud in Settings to keep a copy and to play on your other devices.' }),
      ], [button('OK', closeDialog)], { host: 'idle' });
    }
    return;
  }
  if (data && progress.adopt(data)) {
    if (!$('title-screen').hidden) showTitle();
    else if (!$('map-screen').hidden && $('dialog').hidden) showMap();
  }
  cloudStore(progress.data);
}

if (isNative) {
  progress.onSave = cloudStore;
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && (!$('title-screen').hidden || !$('map-screen').hidden)) syncCloud();
  });
}

// The native app has its files inside it: no offline worker there.
if (!isNative && 'serviceWorker' in navigator && window.isSecureContext) {
  // When an update takes over, restart on the new version right away, but
  // only from the start screen so a level in progress is never lost.
  const hadWorker = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadWorker && !$('title-screen').hidden) location.reload();
  });
  navigator.serviceWorker.register('./sw.js');
}

// A shortcut for tests: index.html?dev=level:62 opens that level and
// ?dev=map opens the map, in the Easy save. The native app cannot start
// with a query, so the simulator checks use a copy of index.html that has
// <html data-dev="map"> (or "level:62").
const dev = new URLSearchParams(location.search).get('dev') ?? document.documentElement.dataset.dev;
if (dev) {
  progress.use('easy');
  const level = LEVELS.find((l) => l.id === Number(dev.split(':')[1]));
  if (level) showGame(level);
  else showMap();
} else {
  showTitle();
  if (isNative) syncCloud();
}
