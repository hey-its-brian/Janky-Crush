// Background music: a bouncy, whimsical sweet-shop waltz played live with
// Web Audio. Pizzicato strings go "oom-pah-pah" in 6/8 under a glockenspiel
// tune. 'map' mood is light (pizzicato and bells); 'level' adds a string
// pad, a celesta an octave up, a counter-line and soft percussion. Notes
// are scheduled a little ahead on a timer, the usual way to keep Web Audio
// music in time.

import { audioContext, musicOutput, onUnlock } from './sfx.js';
import { glock, pluck, pad, bell } from './synth.js';

const BPM = 74; // dotted quarters
const STEP = 60 / BPM / 3; // an eighth note
const BAR = 6; // eighths in a bar of 6/8
const AHEAD = 0.15;

// Sixteen bars. Chord tones and the bass root are semitones from C4 / C3.
const C = { notes: [0, 4, 7], bass: 0 };
const Am = { notes: [-3, 0, 4], bass: -3 };
const F = { notes: [-3, 0, 5], bass: -7 };
const G7 = { notes: [-1, 2, 5], bass: -5 };
const E7 = { notes: [-4, -1, 2], bass: -8 };
const Dm = { notes: [2, 5, 9], bass: 2 };
const A7 = { notes: [1, 4, 7], bass: -3 };
const CHORDS = [C, Am, F, G7, C, E7, F, G7, F, C, Dm, G7, C, A7, Dm, G7];

// The tune: one bar per row, eighths as semitones above C5 (null = rest).
const _ = null;
const MELODY = [
  [4, _, 7, 12, _, 11], [12, _, 9, 4, _, _], [5, _, 9, 12, _, 14], [14, 12, 11, 7, _, _],
  [4, _, 7, 12, _, 16], [16, _, 14, 11, _, 8], [9, _, 12, 17, _, 16], [14, _, 11, 12, _, _],
  [9, _, 12, 9, _, 5], [7, _, 4, 7, _, 12], [14, _, 12, 9, _, 5], [7, _, 5, 2, _, _],
  [4, _, 7, 12, _, 16], [16, _, 13, 9, _, 7], [5, _, 9, 14, _, 12], [11, _, 14, 12, 11, 7],
];
// A lower answering line for the level mood: long notes on beat two.
const COUNTER = [7, 4, 0, 2, 7, 8, 9, 11, 5, 4, 5, 2, 7, 9, 5, 2];

const hz = (semi, root) => root * 2 ** (semi / 12);
const C3 = 130.81, C4 = 261.63, C5 = 523.25;

let mood = null;
let timer = null;
let nextTime = 0;
let step = 0;
let out = null;

let shakerBuf = null;
function shaker(ctx, t, vol) {
  if (!shakerBuf || shakerBuf.sampleRate !== ctx.sampleRate) {
    shakerBuf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    const d = shakerBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  }
  const src = ctx.createBufferSource();
  src.buffer = shakerBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 6500;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(out);
  src.start(t);
}

function thump(ctx, t, vol) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.2);
}

function scheduleStep(ctx, s, t) {
  const barNo = Math.floor(s / BAR) % CHORDS.length;
  const beat = s % BAR;
  const chord = CHORDS[barNo];
  const full = mood === 'level';
  // Oom: the bass on each dotted-quarter beat (root, then fifth).
  if (beat === 0) pluck(ctx, out, hz(chord.bass, C3), t, { vol: 0.34, dur: 0.5, soft: 0.6 });
  if (beat === 3) pluck(ctx, out, hz(chord.bass + 7, C3), t, { vol: 0.26, dur: 0.45, soft: 0.6 });
  // Pah-pah: chord plucks on the other eighths.
  if (beat !== 0 && beat !== 3) {
    chord.notes.forEach((n, i) => pluck(ctx, out, hz(n, C4), t + i * 0.006, { vol: 0.09, dur: 0.22, soft: 0.5 }));
  }
  // The tune on glockenspiel (every phrase in levels, every other in the map).
  const n = MELODY[barNo][beat];
  const phrase = Math.floor(s / (BAR * 8)) % 2;
  if (n !== null && (full || phrase === 0)) {
    glock(ctx, out, hz(n, C5), t, { vol: full ? 0.12 : 0.1, dur: 1.1 });
    if (full) bell(ctx, out, hz(n, C5 * 2), t, { vol: 0.025, dur: 0.5, ratio: 4, index: 1 });
  }
  // Map, second phrase: just a gentle celesta answer on the downbeats.
  if (!full && phrase === 1 && beat === 0) glock(ctx, out, hz(chord.notes[2] + 12, C4), t, { vol: 0.07, dur: 1.2 });
  if (full) {
    if (beat === 0) {
      chord.notes.forEach((x) => pad(ctx, out, hz(x, C4), t, { dur: STEP * BAR + 0.1, vol: 0.022 }));
      thump(ctx, t, 0.3);
    }
    if (beat === 3) pluck(ctx, out, hz(COUNTER[barNo], C4), t, { vol: 0.12, dur: 0.6, soft: 0.35 });
    shaker(ctx, t, beat === 0 || beat === 3 ? 0.07 : 0.035);
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

// Start (or switch) the music: 'map' or 'level'. Waits for the first tap.
export function playMusic(next) {
  mood = next;
  onUnlock((ctx) => {
    out ??= musicOutput();
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

// Render `seconds` of music in a mood into an offline context (tools only).
export function renderMusic(off, output, which, seconds) {
  const saved = { mood, out };
  mood = which;
  out = output;
  for (let t = 0.05, s = 0; t < seconds; t += STEP, s++) scheduleStep(off, s, t);
  mood = saved.mood;
  out = saved.out;
}
