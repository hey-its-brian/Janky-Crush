// Sound effects, synthesized with Web Audio: no sound files. iPhones only
// allow audio after a tap, so unlockAudio() runs on the first touch.
//
// Each effect is a short recipe of warm, natural sounds: coconut knocks,
// marimba, water bubbles, splashes and rushes. Every match knocks and
// rings a marimba note, climbing the scale as a cascade goes on. There's a
// little room reverb, everything is kept soft on top (no tinny highs), and
// each sound is placed left or right where it happened on the board. `play(name, opts)` is the
// one entry point; effects that can fire dozens of times a second are
// rate-limited.

import { getSetting, onSettingChange } from '../settings.js';
import { marimba, pluck, brass, makeRoom, softened } from './synth.js';

let ctx = null;
let master, sfxBus, musicBus, noiseBuf;
let dest = null; // where the effect being played goes (its stereo panner)
let base = 0; // extra start offset, used when rendering a preview offline

// Comfortable on a phone speaker at a low volume; the effects sit under
// the music rather than on top of it.
const SFX_LEVEL = 1.3;
const MUSIC_LEVEL = 0.42;
const unlockListeners = [];

export function audioContext() {
  return ctx;
}

export function musicOutput() {
  return musicBus;
}

export function onUnlock(fn) {
  if (ctx) fn(ctx);
  else unlockListeners.push(fn);
}

// Call from a touch handler. Creates the context the first time and wakes
// it up after the app comes back to the foreground.
export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    // Respect the iPhone's silent switch like other casual games.
    if (navigator.audioSession) navigator.audioSession.type = 'ambient';
    ctx = new AC();
    buildBuses(ctx, getSetting('sfx') ? SFX_LEVEL : 0, getSetting('music') ? MUSIC_LEVEL : 0);
    for (const fn of unlockListeners.splice(0)) fn(ctx);
  }
  if (ctx.state !== 'running') ctx.resume();
}

onSettingChange((name, on) => {
  if (!ctx) return;
  const t = ctx.currentTime;
  if (name === 'sfx') sfxBus.gain.setTargetAtTime(on ? SFX_LEVEL : 0, t, 0.05);
  if (name === 'music') musicBus.gain.setTargetAtTime(on ? MUSIC_LEVEL : 0, t, 0.2);
});

// Go quiet while the app is in the background.
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend();
  else ctx.resume();
});

// Everything goes through a fast limiter so a big combo doesn't clip.
// Browsers add their own make-up gain inside the compressor, so the level
// is trimmed after it too.
function buildMaster(c) {
  const input = c.createGain();
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 6;
  comp.ratio.value = 8;
  comp.attack.value = 0.001;
  comp.release.value = 0.18;
  const trim = c.createGain();
  trim.gain.value = 0.42;
  input.connect(comp).connect(trim).connect(c.destination);
  return input;
}

// Effects and music each get a bus, both with a send into one shared room.
function buildBuses(c, sfxLevel, musicLevel) {
  master = buildMaster(c);
  const room = makeRoom(c);
  room.connect(master);
  sfxBus = c.createGain();
  sfxBus.gain.value = sfxLevel;
  sfxBus.connect(master);
  const sfxSend = c.createGain();
  sfxSend.gain.value = 0.22;
  sfxBus.connect(sfxSend).connect(room);
  musicBus = c.createGain();
  musicBus.gain.value = musicLevel;
  musicBus.connect(master);
  const musicSend = c.createGain();
  musicSend.gain.value = 0.3;
  musicBus.connect(musicSend).connect(room);
  noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

// ---- building blocks ---------------------------------------------------------

const T = (at = 0) => ctx.currentTime + base + at;

// An oscillator with an attack/decay envelope and optional pitch glide.
function tone({ type = 'sine', freq, to = null, at = 0, dur = 0.2, vol = 0.3, attack = 0.005, out = dest, detune = 0, vibrato = 0 }) {
  const t = T(at);
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  o.detune.value = detune;
  if (vibrato) {
    // A cartoon wobble in the pitch.
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = vibrato;
    depth.gain.value = 60;
    lfo.connect(depth).connect(o.detune);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

// Filtered noise burst: splashes, booms, whooshes, crunch.
function noise({ at = 0, dur = 0.2, vol = 0.3, type = 'lowpass', freq = 1000, to = null, q = 1, attack = 0.005, out = dest }) {
  const t = T(at);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

const mallet = (freq, at, o) => marimba(ctx, dest, freq, T(at), o);
const pizz = (freq, at, o) => pluck(ctx, dest, freq, T(at), { soft: 0.8, ...o });
const horn = (freq, at, o) => brass(ctx, dest, freq, T(at), { bright: 1500, ...o });

// Knocking on a coconut: a hollow wooden tone with a tiny click.
function knock(freq, { at = 0, vol = 0.2 } = {}) {
  tone({ freq: freq * 1.08, to: freq, dur: 0.09, vol, attack: 0.002, at });
  tone({ freq: freq * 1.52, dur: 0.04, vol: vol * 0.35, attack: 0.002, at });
  noise({ type: 'bandpass', freq: freq * 2, q: 4, dur: 0.015, vol: vol * 0.4, attack: 0.001, at });
}

// A water bubble: a quick upward "bloop".
function bloop(freq, { at = 0, vol = 0.15, dur = 0.07 } = {}) {
  tone({ freq, to: freq * 2.3, dur, vol, attack: 0.004, at });
}

// Water rushing: noise through a sweeping lowpass.
function wash({ at = 0, dur = 0.4, vol = 0.2, from = 400, to = 2000, attack = 0.05 } = {}) {
  noise({ type: 'lowpass', freq: from, to, q: 0.8, dur, vol, at, attack });
}

// A handful of bubbles rising after a splash.
function bubbles({ at = 0, count = 4, spread = 0.3, vol = 0.08 } = {}) {
  for (let i = 0; i < count; i++) bloop(260 + Math.random() * 320, { at: at + Math.random() * spread, vol });
}

// A major scale in the warm middle range: matches climb it each cascade.
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const major = (step, root = 392) => root * 2 ** ((MAJOR[((step % 7) + 7) % 7] + 12 * Math.floor(step / 7)) / 12);
const C4 = 261.63;
const semi = (n, root = C4) => root * 2 ** (n / 12);

// ---- the effects ------------------------------------------------------------------

const RECIPES = {
  click: () => {
    knock(720, { vol: 0.13 });
  },
  // Two pieces sliding past each other: a soft swish of water.
  swap: () => {
    wash({ dur: 0.16, vol: 0.2, from: 300, to: 1300, attack: 0.05 });
    knock(480, { vol: 0.05, at: 0.1 });
  },
  // A swap that doesn't match: a hollow wooden "bonk" that sags.
  boing: () => {
    tone({ freq: 320, to: 150, dur: 0.3, vol: 0.18, vibrato: 14 });
    knock(260, { vol: 0.1 });
  },
  // Every match: a coconut knock, a marimba note and a bubble, a step
  // higher with each cascade. Bigger matches add a harmony.
  match: ({ chain = 1, size = 3 } = {}) => {
    const step = Math.min(chain - 1, 10);
    const f = major(step);
    knock(f * 1.5, { vol: 0.16 });
    mallet(f, 0.005, { dur: 0.7, vol: 0.2 });
    bloop(f * 0.75, { at: 0.03, vol: 0.08 });
    if (size >= 4) mallet(major(step + 2), 0.04, { dur: 0.6, vol: 0.12 });
    if (size >= 5) mallet(major(step + 4), 0.08, { dur: 0.6, vol: 0.1 });
    if (chain >= 4) bubbles({ at: 0.05, count: 3, vol: 0.05 });
  },
  // Each piece as it pops: a little bubble.
  pop: () => {
    bloop(300 + Math.random() * 260, { vol: 0.045 });
  },
  // A special piece forms. Stripes roll up the marimba, wrapped bloops,
  // a bomb swells like a wave.
  sparkle: ({ kind = 'stripe' } = {}) => {
    if (kind === 'bomb') {
      for (let i = 0; i < 8; i++) mallet(major(i, C4), i * 0.05, { dur: 0.6, vol: 0.11 });
      wash({ dur: 0.6, vol: 0.14, from: 200, to: 1800, attack: 0.35 });
      bubbles({ at: 0.3, count: 5 });
    } else if (kind === 'wrapped') {
      bloop(180, { vol: 0.18, dur: 0.14 });
      mallet(semi(7), 0.1, { dur: 0.7, vol: 0.14 });
      bubbles({ at: 0.1, count: 3 });
    } else {
      [0, 4, 7].forEach((n, i) => mallet(semi(n + 7), i * 0.06, { dur: 0.6, vol: 0.13 }));
    }
  },
  // A striped piece fires: a rush of water sweeping across.
  zap: ({ dir = 'row' } = {}) => {
    if (dir === 'row' && dest.pan) {
      const t = T();
      dest.pan.setValueAtTime(-0.7, t);
      dest.pan.linearRampToValueAtTime(0.7, t + 0.35);
    }
    wash({ dur: 0.42, vol: 0.3, from: 2600, to: 300, attack: 0.01 });
    tone({ freq: 180, to: 70, dur: 0.25, vol: 0.2 });
    knock(400, { vol: 0.12 });
    bubbles({ at: 0.15, count: 3, vol: 0.06 });
  },
  // The wrapped piece swells before it blows: a slow rising bubble.
  windup: () => {
    bloop(140, { vol: 0.16, dur: 0.2 });
    wash({ dur: 0.2, vol: 0.08, from: 300, to: 1200, attack: 0.15 });
  },
  // Wrapped explosion: a deep "bloosh" like a cannonball into the pool.
  boom: () => {
    tone({ freq: 120, to: 34, dur: 0.55, vol: 0.5 });
    noise({ type: 'lowpass', freq: 1600, to: 120, dur: 0.7, vol: 0.4, attack: 0.004 });
    knock(220, { vol: 0.2 });
    bubbles({ at: 0.12, count: 6, spread: 0.45, vol: 0.07 });
  },
  // One color-bomb bolt: a water drop "plip" and a tap.
  bolt: () => {
    bloop(380 + Math.random() * 280, { vol: 0.12, dur: 0.06 });
    knock(600 + Math.random() * 200, { vol: 0.06 });
  },
  // A piece turning into a special: the marimba climbs, one step each.
  morph: ({ i = 0 } = {}) => {
    mallet(major(i % 10, C4), 0, { dur: 0.5, vol: 0.13 });
  },
  // Foam bursting: a soft bubble.
  foam: () => {
    bloop(240 + Math.random() * 120, { vol: 0.16, dur: 0.08 });
  },
  // A piece landing: a light wooden tap.
  land: ({ hard = 0.5 } = {}) => {
    knock(300, { vol: 0.02 + 0.04 * hard });
  },
  // An ingredient drops out: a splash and a happy two-note marimba.
  splash: () => {
    noise({ type: 'lowpass', freq: 2500, to: 300, dur: 0.5, vol: 0.28, attack: 0.01 });
    bubbles({ at: 0.05, count: 5 });
    mallet(semi(7), 0.1, { dur: 0.6, vol: 0.15 });
    mallet(semi(12), 0.24, { dur: 0.8, vol: 0.16 });
  },
  quack: () => {
    // A squeaky rubber-duck "quack": nasal square wave through a bandpass.
    const t = T();
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(620, t);
    o.frequency.linearRampToValueAtTime(760, t + 0.04);
    o.frequency.exponentialRampToValueAtTime(380, t + 0.2);
    f.type = 'bandpass';
    f.frequency.value = 1200;
    f.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(f).connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.25);
  },
  // No moves left, so the board mixes itself: a swirl of water.
  shuffle: () => {
    wash({ dur: 0.55, vol: 0.2, from: 300, to: 1500, attack: 0.2 });
    for (let i = 0; i < 6; i++) mallet(major(8 - i, C4), i * 0.06, { dur: 0.4, vol: 0.08 });
  },
  // Under the announcer: a marimba flourish that grows with each tier.
  cheer: ({ tier = 1 } = {}) => {
    const runs = [[0, 2, 4], [0, 2, 4, 7], [0, 2, 4, 5, 7, 9], [0, 2, 4, 5, 7, 9, 11, 14]];
    const run = runs[Math.min(3, tier - 1)];
    run.forEach((n, i) => mallet(semi(n), i * 0.05, { dur: 0.6, vol: 0.11 }));
    const top = run.length * 0.05;
    [0, 4, 7].forEach((n) => mallet(semi(n), top, { dur: 1, vol: 0.08 }));
    if (tier >= 3) {
      [0, 4, 7].forEach((n) => horn(semi(n - 12), top, { dur: 0.6, vol: 0.06 }));
      bubbles({ at: top, count: tier + 1 });
    }
  },
  // "Janky Crush!": a warm horn fanfare over a marimba run and a splash.
  fanfare: () => {
    [0, 4, 7, 12].forEach((n, i) => horn(semi(n - 12), i * 0.12, { dur: 0.18, vol: 0.08 }));
    [0, 4, 7, 12].forEach((n) => horn(semi(n - 12), 0.5, { dur: 1.1, vol: 0.06 }));
    for (let i = 0; i < 10; i++) mallet(major(i, C4), 0.5 + i * 0.035, { dur: 0.6, vol: 0.08 });
    tone({ freq: 100, to: 40, dur: 0.5, vol: 0.35, at: 0.5 });
    noise({ type: 'lowpass', freq: 2200, to: 300, dur: 0.8, vol: 0.2, at: 0.5, attack: 0.005 });
    bubbles({ at: 0.6, count: 6, spread: 0.6 });
  },
  // Each star on the results: a knock and a marimba note, higher each time.
  star: ({ i = 0 } = {}) => {
    const f = [semi(4), semi(7), semi(12)][Math.min(2, i)];
    mallet(f, 0, { dur: 1, vol: 0.2 });
    mallet(f / 2, 0, { dur: 0.8, vol: 0.1 });
    knock(f * 1.5, { vol: 0.1 });
    tone({ freq: 90, to: 50, dur: 0.25, vol: 0.18 });
  },
  tick: () => {
    knock(900, { vol: 0.03 });
  },
  // Level won: a sunny marimba and plucked tune that lands on a chord.
  win: () => {
    const mel = [[0, 0], [4, 0.15], [7, 0.3], [12, 0.45], [9, 0.66], [12, 0.81], [16, 0.96]];
    for (const [n, at] of mel) {
      mallet(semi(n), at, { dur: 0.6, vol: 0.13 });
      pizz(semi(n - 12), at, { vol: 0.14 });
    }
    [0, 4, 7].forEach((n) => horn(semi(n - 12), 0.96, { dur: 1.2, vol: 0.05 }));
    pizz(65.41, 0.96, { vol: 0.3, dur: 0.8 });
    bubbles({ at: 1, count: 5, spread: 0.5 });
  },
  // Out of moves: a droopy, gentle "aww" — slipping down in minor.
  lose: () => {
    [[7, 0], [6, 0.3], [5, 0.6]].forEach(([n, at]) => horn(196 * 2 ** (n / 12), at, { dur: 0.28, vol: 0.07, bright: 1200 }));
    tone({ type: 'triangle', freq: 196 * 2 ** (4 / 12), to: 196 * 2 ** (-1 / 12), dur: 0.9, vol: 0.12, at: 0.9, vibrato: 6 });
    [0, 3, 7].forEach((n, i) => pizz(130.81 * 2 ** (n / 12), 1.1 + i * 0.06, { vol: 0.12 }));
  },
};

// Rate limits (ms) for effects that can pile up.
const LIMIT = { pop: 30, land: 35, foam: 50, bolt: 30, tick: 40, morph: 30, match: 40 };
const lastPlayed = {};

export function play(name, opts) {
  if (!ctx || ctx.state !== 'running' || !getSetting('sfx')) return;
  const now = performance.now();
  if (LIMIT[name] && now - (lastPlayed[name] ?? 0) < LIMIT[name]) return;
  lastPlayed[name] = now;
  if (!RECIPES[name]) return;
  run(name, opts);
}

// Each effect gets its own stereo position: opts.x runs -1 (left) to 1.
function run(name, opts = {}) {
  if (ctx.createStereoPanner) {
    dest = ctx.createStereoPanner();
    dest.pan.value = Math.max(-1, Math.min(1, (opts.x ?? 0) * 0.6));
    dest.connect(softened(ctx, sfxBus, 4500));
  } else {
    dest = softened(ctx, sfxBus, 4500);
  }
  RECIPES[name](opts);
}

// ---- offline preview (tools only) ---------------------------------------------------

// Point the effects at an OfflineAudioContext so a tool can render them to
// a file. Returns the music bus for renderMusic().
export function useOfflineContext(off) {
  ctx = off;
  buildBuses(off, SFX_LEVEL, MUSIC_LEVEL);
  return musicBus;
}

export const EFFECT_NAMES = Object.keys(RECIPES);

export function playAtTime(name, at, opts) {
  base = at;
  run(name, opts);
  base = 0;
}
