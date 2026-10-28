// Background music: slow and calming, played live with Web Audio. A lazy
// "um-pa-pa" in 3/4: a round bass on the beat, soft nylon-guitar chords on
// the two after it, electric piano on the "pa"s, a soft kick and rim, and
// a low melodica tune with a dub echo. The same song plays on the map and
// in levels, carrying on across the switch. Everything goes through a gentle
// lowpass so nothing is shrill. Notes are scheduled a little ahead on a
// timer, the usual way to keep Web Audio music in time.

import { audioContext, musicOutput, onUnlock } from './sfx.js';
import { pluck, epiano, reed, softBass, softened } from './synth.js';

const BPM = 96;
const STEP = 60 / BPM / 2; // an eighth note
const BAR = 6; // eighths in a bar of 3/4
const AHEAD = 0.15;

// Eight bars of soft seventh chords. Tones are semitones from C4; the bass
// root is from C3.
const CHORDS = [
  { notes: [-5, -1, 4], bass: 0 },   // Cmaj7
  { notes: [-5, 0, 4], bass: -3 },   // Am7
  { notes: [-3, 0, 5], bass: 2 },    // Dm7
  { notes: [-7, -1, 5], bass: -5 },  // G7
  { notes: [-5, -1, 2], bass: 4 },   // Em7
  { notes: [-5, 1, 4], bass: -3 },   // A7
  { notes: [-3, 0, 5], bass: 2 },    // Dm7
  { notes: [-7, -1, 2], bass: -5 },  // G7
];

// The tune, low and unhurried: [eighth, semitones above C4] per bar.
const MELODY = [
  [[0, 7], [4, 11]],
  [[0, 9], [4, 7]],
  [[0, 5], [2, 9], [4, 12]],
  [[0, 11]],
  [[0, 7], [4, 11]],
  [[0, 13], [2, 9], [4, 7]],
  [[0, 9], [4, 5]],
  [[0, 2], [2, 5], [4, 7]],
];
// Second time round, a sparser answer so it never feels busy.
const ANSWER = [
  [[2, 4]], [[2, 0]], [[2, 2]], [[2, -1]],
  [[2, 4]], [[2, 1]], [[2, 5]], [[2, 2]],
];

const hz = (semi, root) => root * 2 ** (semi / 12);
const C2 = 65.41, C4 = 261.63;

let timer = null;
let nextTime = 0;
let step = 0;
let bus = null; // the music bus
let out = null; // where instruments play: the bus through a soft lowpass

// A dub echo for the melodica: three eighths, fading.
const echoes = new WeakMap();
function echo(ctx) {
  let e = echoes.get(ctx);
  if (e && e.out === out) return e.input;
  const input = ctx.createGain();
  input.gain.value = 0.35;
  const delay = ctx.createDelay(2);
  delay.delayTime.value = STEP * 3;
  const fb = ctx.createGain();
  fb.gain.value = 0.35;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 1500;
  input.connect(delay).connect(tone).connect(fb).connect(delay);
  tone.connect(out);
  echoes.set(ctx, (e = { input, out }));
  return input;
}

// A soft, low kick.
function kick(ctx, t, vol) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(90, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.32);
}

// A hollow wooden rim click.
function rim(ctx, t, vol) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(820, t);
  o.frequency.exponentialRampToValueAtTime(700, t + 0.05);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.08);
}

function scheduleStep(ctx, s, t) {
  const bar = Math.floor(s / BAR);
  const beat = s % BAR;
  const chord = CHORDS[bar % CHORDS.length];
  // Um: the bass and a soft kick on the downbeat, a softer fifth leading
  // into the next bar.
  if (beat === 0) {
    softBass(ctx, out, hz(chord.bass, C2), t, { dur: 0.9, vol: 0.34 });
    kick(ctx, t, 0.22);
  }
  if (beat === 5) softBass(ctx, out, hz(chord.bass + 7, C2), t, { dur: 0.3, vol: 0.14 });
  // Pa-pa: soft guitar and piano chords on beats two and three.
  if (beat === 2 || beat === 4) {
    chord.notes.forEach((n, i) => pluck(ctx, out, hz(n, C4), t + i * 0.015, { vol: beat === 2 ? 0.08 : 0.065, dur: 0.5, soft: 0.85 }));
    chord.notes.forEach((n) => epiano(ctx, out, hz(n, C4), t, { dur: 0.45, vol: 0.035 }));
    rim(ctx, t, 0.04);
  }
  // The tune, then a quieter answer the second time through.
  const second = Math.floor(bar / CHORDS.length) % 2 === 1;
  for (const [at, n] of (second ? ANSWER : MELODY)[bar % CHORDS.length]) {
    if (at !== beat) continue;
    reed(ctx, out, hz(n, C4), t, { dur: STEP * 3, vol: second ? 0.03 : 0.045 });
    reed(ctx, echo(ctx), hz(n, C4), t, { dur: STEP * 3, vol: 0.03 });
  }
}

function tick() {
  const ctx = audioContext();
  if (!ctx || ctx.state !== 'running') return;
  if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
  while (nextTime < ctx.currentTime + AHEAD) {
    scheduleStep(ctx, step, nextTime);
    nextTime += STEP;
    step++;
  }
}

// Start the music (the same song on every screen; it keeps going across
// them). Waits for the first tap.
export function playMusic() {
  onUnlock((ctx) => {
    bus ??= musicOutput();
    out ??= softened(ctx, bus, 2400);
    if (timer) return;
    nextTime = ctx.currentTime + 0.1;
    step = 0;
    timer = setInterval(tick, 25);
  });
}

export function stopMusic() {
  clearInterval(timer);
  timer = null;
}

// Render `seconds` of music into an offline context (tools only).
export function renderMusic(off, output, seconds) {
  const saved = out;
  out = softened(off, output, 2400);
  for (let t = 0.05, s = 0; t < seconds; t += STEP, s++) scheduleStep(off, s, t);
  out = saved;
}
