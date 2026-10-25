// Sound effects, synthesized with Web Audio: no sound files. iPhones only
// allow audio after a tap, so unlockAudio() runs on the first touch.
//
// Each effect is a short recipe of bells, plucks and filtered noise. The
// feel is a sweet-shop arcade: glassy chimes and a juicy crunch for every
// match, climbing the scale as a cascade goes on, with zaps, booms and
// shimmer for the specials, a little room reverb, and each sound placed
// left or right where it happened on the board. `play(name, opts)` is the
// one entry point; effects that can fire dozens of times a second are
// rate-limited.

import { getSetting, onSettingChange } from '../settings.js';
import { bell, glock, pluck, brass, makeRoom } from './synth.js';

let ctx = null;
let master, sfxBus, musicBus, noiseBuf;
let dest = null; // where the effect being played goes (its stereo panner)
let base = 0; // extra start offset, used when rendering a preview offline

// Loud enough for a phone speaker; the limiter catches big explosions.
const SFX_LEVEL = 2.2;
const MUSIC_LEVEL = 0.5;
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
  trim.gain.value = 0.72;
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

const chime = (freq, at, o) => bell(ctx, dest, freq, T(at), o);
const ding = (freq, at, o) => glock(ctx, dest, freq, T(at), o);
const pizz = (freq, at, o) => pluck(ctx, dest, freq, T(at), o);
const horn = (freq, at, o) => brass(ctx, dest, freq, T(at), o);

// A candy crunch: a few quick grains of bright noise and a soft "chomp".
function crunch({ at = 0, vol = 0.2, grains = 4 } = {}) {
  for (let i = 0; i < grains; i++) {
    noise({ type: 'bandpass', freq: 1800 + Math.random() * 2600, q: 1.6, dur: 0.028 + Math.random() * 0.02, vol: vol * (1 - i * 0.15), at: at + i * (0.012 + Math.random() * 0.012), attack: 0.002 });
  }
  tone({ freq: 260, to: 90, dur: 0.06, vol: vol * 0.8, at });
}

// Glitter: a scatter of tiny high pings.
function glitter({ at = 0, count = 5, spread = 0.3, vol = 0.05 } = {}) {
  for (let i = 0; i < count; i++) ding(note(14 + Math.floor(Math.random() * 6)), at + Math.random() * spread, { dur: 0.5, vol });
  noise({ type: 'highpass', freq: 7500, dur: spread + 0.2, vol: vol * 0.8, at, attack: 0.04 });
}

// A major scale: matches climb it, one step per cascade.
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const major = (step, root = 523.25) => root * 2 ** ((MAJOR[((step % 7) + 7) % 7] + 12 * Math.floor(step / 7)) / 12);
// A bright pentatonic scale for sparkles and jingles (C major pentatonic).
const SCALE = [0, 2, 4, 7, 9];
const note = (step, root = 523.25) => root * 2 ** ((SCALE[((step % 5) + 5) % 5] + 12 * Math.floor(step / 5)) / 12);

// ---- the effects ------------------------------------------------------------------

const RECIPES = {
  click: () => {
    tone({ freq: 700, to: 1200, dur: 0.06, vol: 0.22 });
    ding(note(10), 0.01, { dur: 0.25, vol: 0.05 });
  },
  // Two candies sliding past each other: a soft swish.
  swap: () => {
    noise({ type: 'bandpass', freq: 500, to: 3000, q: 1.8, dur: 0.15, vol: 0.42, attack: 0.04 });
    tone({ type: 'triangle', freq: 420, to: 640, dur: 0.1, vol: 0.13 });
  },
  // A swap that doesn't match: a rubbery "bwoing" back.
  boing: () => {
    tone({ freq: 380, to: 140, dur: 0.38, vol: 0.26, vibrato: 18 });
    tone({ type: 'triangle', freq: 190, to: 80, dur: 0.3, vol: 0.1, at: 0.01 });
  },
  // The heart of it: every match crunches and rings a chime, a step higher
  // with each cascade. Bigger matches add a harmony and more crunch.
  match: ({ chain = 1, size = 3 } = {}) => {
    const step = Math.min(chain - 1, 13);
    const f = major(step, 659.25);
    crunch({ vol: 0.2 + 0.04 * Math.min(size - 3, 2), grains: size >= 5 ? 6 : 4 });
    chime(f, 0.005, { dur: 0.8, vol: 0.2, ratio: 3.5, index: 2.2 });
    chime(f * 2, 0.005, { dur: 0.35, vol: 0.05, ratio: 2, index: 1 });
    if (size >= 4) chime(major(step + 2, 659.25), 0.03, { dur: 0.6, vol: 0.1 });
    if (chain >= 4) glitter({ at: 0.05, count: Math.min(chain, 8), vol: 0.04 });
  },
  // Each piece as it pops: a small crunch.
  pop: () => {
    crunch({ vol: 0.07, grains: 2 });
  },
  // A special piece forms. Stripes ding up, wrapped boings, a bomb swirls.
  sparkle: ({ kind = 'stripe' } = {}) => {
    if (kind === 'bomb') {
      for (let i = 0; i < 10; i++) ding(note(5 + i), i * 0.035, { dur: 0.7, vol: 0.09 });
      noise({ type: 'bandpass', freq: 1500, to: 9000, q: 3, dur: 0.45, vol: 0.12, attack: 0.2 });
      tone({ freq: 200, to: 800, dur: 0.4, vol: 0.08, vibrato: 9 });
      glitter({ at: 0.35, count: 8, vol: 0.05 });
    } else if (kind === 'wrapped') {
      tone({ freq: 240, to: 560, dur: 0.22, vol: 0.18, vibrato: 14 });
      chime(note(9), 0.12, { dur: 0.7, vol: 0.14 });
      glitter({ at: 0.1, count: 4 });
    } else {
      [0, 2, 4].forEach((s, i) => chime(note(8 + s), i * 0.055, { dur: 0.6, vol: 0.13 }));
      glitter({ at: 0.12, count: 4 });
    }
  },
  // A striped piece fires: a laser "zwip" that sweeps across, sparkling.
  zap: ({ dir = 'row' } = {}) => {
    if (dir === 'row' && dest.pan) {
      const t = T();
      dest.pan.setValueAtTime(-0.7, t);
      dest.pan.linearRampToValueAtTime(0.7, t + 0.3);
    }
    noise({ type: 'bandpass', freq: 7000, to: 700, q: 5, dur: 0.36, vol: 0.32, attack: 0.004 });
    tone({ type: 'sawtooth', freq: 2600, to: 260, dur: 0.3, vol: 0.09 });
    tone({ type: 'square', freq: 1300, to: 130, dur: 0.26, vol: 0.05, detune: 20 });
    tone({ freq: 160, to: 60, dur: 0.18, vol: 0.2 });
    glitter({ at: 0.12, count: 5, spread: 0.3, vol: 0.05 });
  },
  // The wrapped piece swells before it blows.
  windup: () => {
    tone({ type: 'triangle', freq: 220, to: 880, dur: 0.18, vol: 0.18 });
    noise({ type: 'bandpass', freq: 800, to: 4000, q: 2, dur: 0.18, vol: 0.14, attack: 0.15 });
  },
  // Wrapped explosion: a deep jelly "BOOMF" with a wobble and glitter.
  boom: () => {
    tone({ freq: 140, to: 36, dur: 0.6, vol: 0.6 });
    tone({ freq: 220, to: 120, dur: 0.4, vol: 0.18, vibrato: 11, at: 0.02 });
    noise({ type: 'lowpass', freq: 3200, to: 140, dur: 0.7, vol: 0.45, attack: 0.003 });
    crunch({ vol: 0.18, grains: 5, at: 0.01 });
    glitter({ at: 0.12, count: 7, spread: 0.4, vol: 0.05 });
  },
  // One color-bomb bolt: a bright "tsing" and a crackle.
  bolt: () => {
    ding(note(13 + Math.floor(Math.random() * 5)), 0, { dur: 0.5, vol: 0.11 });
    noise({ type: 'bandpass', freq: 3000 + Math.random() * 3000, q: 7, dur: 0.1, vol: 0.22 });
  },
  // A piece turning into a special: a rising bell, one step each.
  morph: ({ i = 0 } = {}) => {
    chime(major(4 + (i % 10), 523.25), 0, { dur: 0.5, vol: 0.13, ratio: 2, index: 1.5 });
  },
  // Foam bursting: a bubbly "bloop" and a soft squish.
  foam: () => {
    const f = 380 + Math.random() * 160;
    tone({ freq: f, to: f * 3.2, dur: 0.07, vol: 0.2 });
    noise({ type: 'lowpass', freq: 1800, to: 500, dur: 0.08, vol: 0.08 });
  },
  // A piece landing: a light wooden tock.
  land: ({ hard = 0.5 } = {}) => {
    tone({ freq: 520, to: 240, dur: 0.035, vol: 0.03 + 0.06 * hard });
  },
  // An ingredient drops out: a splash and a happy two-note chime.
  splash: () => {
    noise({ type: 'lowpass', freq: 3500, to: 400, dur: 0.5, vol: 0.3, attack: 0.01 });
    noise({ type: 'bandpass', freq: 1200, q: 3, dur: 0.25, vol: 0.1, at: 0.05 });
    chime(note(7), 0.08, { dur: 0.6, vol: 0.14 });
    chime(note(10), 0.2, { dur: 0.9, vol: 0.16 });
    glitter({ at: 0.25, count: 4 });
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
    f.frequency.value = 1300;
    f.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.7, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(f).connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.25);
  },
  // No moves left, so the board mixes itself: a swirling whoosh.
  shuffle: () => {
    noise({ type: 'bandpass', freq: 400, to: 3000, q: 1.5, dur: 0.5, vol: 0.18, attack: 0.15 });
    for (let i = 0; i < 8; i++) ding(note(12 - i), i * 0.05, { dur: 0.4, vol: 0.06 });
  },
  // Under the announcer: a bell flourish that grows with each tier.
  cheer: ({ tier = 1 } = {}) => {
    const runs = [[0, 2, 4], [0, 2, 4, 7], [0, 2, 4, 5, 7, 9], [0, 2, 4, 5, 7, 9, 11, 14]];
    const run = runs[Math.min(3, tier - 1)];
    run.forEach((s, i) => ding(major(s + 7, 523.25), i * 0.045, { dur: 0.8, vol: 0.09 }));
    const top = run.length * 0.045;
    [0, 4, 7].forEach((s) => chime(523.25 * 2 ** ((s + 12) / 12), top, { dur: 1.1, vol: 0.07 }));
    if (tier >= 3) {
      [0, 4, 7].forEach((s) => horn(261.63 * 2 ** (s / 12), top, { dur: 0.5, vol: 0.06 }));
      glitter({ at: top, count: 6 + tier, spread: 0.5 });
    }
  },
  // "Janky Crush!": a brassy fanfare over a glockenspiel run and a crash.
  fanfare: () => {
    [0, 4, 7, 12].forEach((s, i) => horn(261.63 * 2 ** (s / 12), i * 0.11, { dur: 0.16, vol: 0.08 }));
    [0, 4, 7, 12].forEach((s) => horn(261.63 * 2 ** (s / 12), 0.46, { dur: 1.1, vol: 0.06 }));
    for (let i = 0; i < 12; i++) ding(note(5 + i), 0.46 + i * 0.03, { dur: 0.8, vol: 0.07 });
    tone({ freq: 110, to: 40, dur: 0.5, vol: 0.4, at: 0.46 });
    noise({ type: 'highpass', freq: 4000, dur: 1.2, vol: 0.12, at: 0.46, attack: 0.005 });
    glitter({ at: 0.6, count: 10, spread: 0.8 });
  },
  // Each star on the results: a ringing bell, higher each time.
  star: ({ i = 0 } = {}) => {
    const f = [659.25, 783.99, 1046.5][Math.min(2, i)];
    chime(f, 0, { dur: 1.2, vol: 0.2 });
    ding(f * 2, 0.02, { dur: 0.8, vol: 0.06 });
    tone({ freq: 90, to: 50, dur: 0.25, vol: 0.2 });
    glitter({ at: 0.04, count: 6 });
  },
  tick: () => {
    ding(2093, 0, { dur: 0.08, vol: 0.04 });
  },
  // Level won: a bouncy pizzicato and bell tune that lands on a chord.
  win: () => {
    const mel = [[0, 0], [4, 0.14], [7, 0.28], [12, 0.42], [9, 0.62], [12, 0.76], [16, 0.9]];
    for (const [s, at] of mel) {
      ding(523.25 * 2 ** (s / 12), at, { dur: 0.7, vol: 0.12 });
      pizz(261.63 * 2 ** (s / 12), at, { vol: 0.16 });
    }
    [0, 4, 7, 12].forEach((s) => horn(261.63 * 2 ** (s / 12), 0.9, { dur: 1.2, vol: 0.05 }));
    pizz(65.41, 0.9, { vol: 0.3, dur: 0.8 });
    glitter({ at: 0.95, count: 10, spread: 0.7 });
  },
  // Out of moves: a droopy, gentle "aww" — slipping down in minor.
  lose: () => {
    [[7, 0], [6, 0.3], [5, 0.6]].forEach(([s, at]) => horn(196 * 2 ** (s / 12), at, { dur: 0.28, vol: 0.07, bright: 1400 }));
    tone({ type: 'triangle', freq: 196 * 2 ** (4 / 12), to: 196 * 2 ** (-1 / 12), dur: 0.9, vol: 0.14, at: 0.9, vibrato: 6 });
    [0, 3, 7].forEach((s, i) => pizz(130.81 * 2 ** (s / 12), 1.1 + i * 0.06, { vol: 0.12 }));
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
    dest.connect(sfxBus);
  } else {
    dest = sfxBus;
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
