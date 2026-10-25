// Sound effects, synthesized with Web Audio: no sound files. iPhones only
// allow audio after a tap, so unlockAudio() runs on the first touch.
//
// Each effect is a short recipe of oscillators and filtered noise with
// quick envelopes. `play(name, opts)` is the one entry point; effects that
// can fire dozens of times a second (pops, landings) are rate-limited.

import { getSetting, onSettingChange } from '../settings.js';

let ctx = null;
let master, sfxBus, musicBus, noiseBuf;
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
    master = buildMaster(ctx);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = getSetting('sfx') ? SFX_LEVEL : 0;
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = getSetting('music') ? MUSIC_LEVEL : 0;
    musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
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

// ---- building blocks ---------------------------------------------------------

// An oscillator with an attack/decay envelope and optional pitch glide.
function tone({ type = 'sine', freq, to = null, at = 0, dur = 0.2, vol = 0.3, attack = 0.005, out = sfxBus, detune = 0 }) {
  const t = ctx.currentTime + base + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  o.detune.value = detune;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

// Filtered noise burst: splashes, booms, whooshes, crackle.
function noise({ at = 0, dur = 0.2, vol = 0.3, type = 'lowpass', freq = 1000, to = null, q = 1, attack = 0.005, out = sfxBus }) {
  const t = ctx.currentTime + base + at;
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

// A bright pentatonic scale for pops and jingles (C major pentatonic).
const SCALE = [0, 2, 4, 7, 9];
const note = (step, base = 523.25) => base * 2 ** ((SCALE[((step % 5) + 5) % 5] + 12 * Math.floor(step / 5)) / 12);

// ---- the effects ------------------------------------------------------------------

const RECIPES = {
  click: () => {
    tone({ type: 'sine', freq: 900, to: 1300, dur: 0.07, vol: 0.18 });
  },
  swap: () => {
    noise({ type: 'bandpass', freq: 600, to: 2400, q: 2, dur: 0.16, vol: 0.32, attack: 0.03 });
    tone({ type: 'triangle', freq: 520, to: 780, dur: 0.12, vol: 0.14 });
  },
  boing: () => {
    tone({ type: 'sine', freq: 300, to: 120, dur: 0.35, vol: 0.28 });
    tone({ type: 'sine', freq: 340, to: 150, dur: 0.3, vol: 0.12, at: 0.02, detune: 30 });
  },
  // A bubbly pop; climbs a step of the scale with each link of a chain.
  pop: ({ chain = 1, size = 1 } = {}) => {
    const f = note(chain + 2);
    tone({ type: 'sine', freq: f * 1.6, to: f, dur: 0.11, vol: 0.22 + 0.04 * Math.min(size, 3) });
    tone({ type: 'triangle', freq: f * 2, to: f * 1.2, dur: 0.06, vol: 0.06 });
    noise({ type: 'highpass', freq: 3000, dur: 0.03, vol: 0.05 });
  },
  sparkle: () => {
    [0, 1, 2, 3].forEach((i) => tone({ type: 'triangle', freq: note(10 + i * 2), dur: 0.22, vol: 0.12, at: i * 0.05 }));
    noise({ type: 'highpass', freq: 7000, dur: 0.3, vol: 0.04, attack: 0.05 });
  },
  zap: () => {
    tone({ type: 'sawtooth', freq: 1800, to: 180, dur: 0.32, vol: 0.18 });
    tone({ type: 'square', freq: 900, to: 90, dur: 0.28, vol: 0.09, detune: 15 });
    noise({ type: 'bandpass', freq: 4000, to: 800, q: 4, dur: 0.3, vol: 0.2 });
  },
  boom: () => {
    tone({ type: 'sine', freq: 150, to: 38, dur: 0.6, vol: 0.55 });
    noise({ type: 'lowpass', freq: 2200, to: 120, dur: 0.7, vol: 0.4, attack: 0.004 });
    noise({ type: 'highpass', freq: 5000, dur: 0.4, vol: 0.06, at: 0.08, attack: 0.05 });
  },
  windup: () => {
    tone({ type: 'triangle', freq: 300, to: 900, dur: 0.17, vol: 0.12 });
  },
  bolt: () => {
    noise({ type: 'bandpass', freq: 2500 + Math.random() * 2000, q: 6, dur: 0.12, vol: 0.36 });
    tone({ type: 'square', freq: 1400 + Math.random() * 600, to: 300, dur: 0.08, vol: 0.1 });
  },
  morph: ({ i = 0 } = {}) => {
    tone({ type: 'sine', freq: note(8 + (i % 6)), dur: 0.25, vol: 0.16 });
    tone({ type: 'sine', freq: note(8 + (i % 6)) * 2, dur: 0.15, vol: 0.05 });
  },
  foam: () => {
    tone({ type: 'sine', freq: 500 + Math.random() * 300, to: 1500, dur: 0.06, vol: 0.2 });
  },
  land: ({ hard = 0.5 } = {}) => {
    tone({ type: 'sine', freq: 180, to: 90, dur: 0.06, vol: 0.05 + 0.08 * hard });
  },
  splash: () => {
    noise({ type: 'lowpass', freq: 3500, to: 400, dur: 0.5, vol: 0.32, attack: 0.01 });
    noise({ type: 'bandpass', freq: 1200, q: 3, dur: 0.25, vol: 0.12, at: 0.05 });
  },
  quack: () => {
    // A squeaky rubber-duck "quack": nasal square wave through a bandpass.
    const t = ctx.currentTime + base;
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
    o.connect(f).connect(g).connect(sfxBus);
    o.start(t);
    o.stop(t + 0.25);
  },
  shuffle: () => {
    noise({ type: 'bandpass', freq: 400, to: 3000, q: 1.5, dur: 0.45, vol: 0.18, attack: 0.1 });
  },
  cheer: ({ tier = 1 } = {}) => {
    const steps = [[0, 2, 4], [0, 2, 4, 7], [0, 4, 7, 9, 12], [0, 4, 7, 12, 14, 16]][Math.min(3, tier - 1)];
    steps.forEach((s, i) => {
      tone({ type: 'triangle', freq: note(s + 5), dur: 0.22, vol: 0.14, at: i * 0.07 });
      tone({ type: 'sine', freq: note(s + 5) / 2, dur: 0.18, vol: 0.08, at: i * 0.07 });
    });
  },
  fanfare: () => {
    // "Janky Crush!": a bright rising run that lands on a chord.
    [0, 2, 4, 5, 7].forEach((s, i) => tone({ type: 'triangle', freq: note(s + 3), dur: 0.18, vol: 0.14, at: i * 0.08 }));
    [7, 9, 12].forEach((s) => tone({ type: 'sawtooth', freq: note(s), dur: 0.9, vol: 0.05, at: 0.42, attack: 0.02 }));
    [7, 9, 12].forEach((s) => tone({ type: 'triangle', freq: note(s), dur: 0.9, vol: 0.1, at: 0.42 }));
  },
  star: ({ i = 0 } = {}) => {
    const f = note(7 + i * 2);
    tone({ type: 'triangle', freq: f, dur: 0.4, vol: 0.18 });
    tone({ type: 'sine', freq: f * 2, dur: 0.3, vol: 0.06 });
    noise({ type: 'highpass', freq: 6000, dur: 0.25, vol: 0.05 });
  },
  tick: () => {
    tone({ type: 'sine', freq: 1800, dur: 0.025, vol: 0.05 });
  },
  win: () => {
    const mel = [[0, 0.0], [4, 0.12], [7, 0.24], [12, 0.36], [9, 0.52], [12, 0.64]];
    for (const [s, at] of mel) tone({ type: 'triangle', freq: 392 * 2 ** (s / 12), dur: 0.3, vol: 0.16, at });
    [0, 4, 7].forEach((s) => tone({ type: 'sine', freq: 196 * 2 ** (s / 12), dur: 1.1, vol: 0.09, at: 0.64 }));
  },
  lose: () => {
    [[0, 0], [-1, 0.28], [-2, 0.56], [-3.5, 0.84]].forEach(([s, at], i) =>
      tone({ type: 'triangle', freq: 330 * 2 ** (s / 12), to: i === 3 ? 330 * 2 ** (-5 / 12) : null, dur: i === 3 ? 0.7 : 0.26, vol: 0.15, at }));
  },
};

// Rate limits (ms) for effects that can pile up.
const LIMIT = { pop: 45, land: 35, foam: 50, bolt: 30, tick: 40, morph: 30 };
const lastPlayed = {};

export function play(name, opts) {
  if (!ctx || ctx.state !== 'running' || !getSetting('sfx')) return;
  const now = performance.now();
  if (LIMIT[name] && now - (lastPlayed[name] ?? 0) < LIMIT[name]) return;
  lastPlayed[name] = now;
  RECIPES[name]?.(opts);
}

// ---- offline preview (tools only) ---------------------------------------------------

// Point the effects at an OfflineAudioContext so a tool can render them to
// a file. Returns the music bus for renderMusic().
export function useOfflineContext(off) {
  ctx = off;
  master = buildMaster(off);
  sfxBus = off.createGain();
  sfxBus.gain.value = SFX_LEVEL;
  sfxBus.connect(master);
  musicBus = off.createGain();
  musicBus.gain.value = MUSIC_LEVEL;
  musicBus.connect(master);
  noiseBuf = off.createBuffer(1, off.sampleRate, off.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return musicBus;
}

export const EFFECT_NAMES = Object.keys(RECIPES);

export function playAtTime(name, at, opts) {
  base = at;
  RECIPES[name](opts);
  base = 0;
}
