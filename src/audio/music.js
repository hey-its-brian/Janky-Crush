// Background music: a sunny tropical loop played live with Web Audio.
// Marimba chords, a bouncy bass, shaker and a steel-drum melody over
// C – Am – F – G. 'map' mood is mellow (no kick, sparser melody); 'level'
// is fuller. Notes are scheduled a little ahead on a timer, the usual way
// to keep Web Audio music in time.

import { audioContext, musicOutput, onUnlock } from './sfx.js';

const BPM = 108;
const STEP = 60 / BPM / 4; // a 16th note
const AHEAD = 0.15;

// Chords as semitones above C4; bass root below.
const CHORDS = [
  { notes: [0, 4, 7], bass: -24 },    // C
  { notes: [-3, 0, 4], bass: -27 },   // Am
  { notes: [-7, -3, 0], bass: -31 },  // F
  { notes: [-5, -1, 2], bass: -29 },  // G
];
// Two-bar melody phrases (16th steps → semitones above C5, null = rest).
const PHRASES = [
  [7, null, 9, null, 12, null, 9, 7, null, 4, null, 7, null, null, 4, null,
    2, null, 4, null, 7, null, null, 4, 2, null, 0, null, null, null, null, null],
  [12, null, null, 9, null, 7, null, 9, null, 12, null, 14, 12, null, 9, null,
    7, null, 9, null, 4, null, 7, null, null, null, 2, null, 4, null, null, null],
];

const hz = (semi, base = 261.63) => base * 2 ** (semi / 12);

let mood = null;
let timer = null;
let nextTime = 0;
let step = 0;
let out = null;

function marimba(ctx, freq, t, vol) {
  const o = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  const g = ctx.createGain();
  const g2 = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  o2.type = 'sine';
  o2.frequency.value = freq * 4; // the wooden "tock" overtone
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  g2.gain.setValueAtTime(0.0001, t);
  g2.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.002);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  o.connect(g).connect(out);
  o2.connect(g2).connect(out);
  o.start(t); o2.start(t);
  o.stop(t + 0.5); o2.stop(t + 0.1);
}

function steelDrum(ctx, freq, t, vol) {
  for (const [mult, v, d] of [[1, 1, 0.5], [2.01, 0.4, 0.3], [3.02, 0.15, 0.18]]) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq * mult;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * v, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + d + 0.05);
  }
}

function bass(ctx, freq, t, vol) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.35);
}

let shakerBuf = null;
function shaker(ctx, t, vol) {
  if (!shakerBuf) {
    shakerBuf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const d = shakerBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  }
  const src = ctx.createBufferSource();
  src.buffer = shakerBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(out);
  src.start(t);
}

function kick(ctx, t, vol) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(130, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.14);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.2);
}

function scheduleStep(ctx, s, t) {
  const bar = Math.floor(s / 16) % 4;
  const beat = s % 16;
  const chord = CHORDS[bar];
  const full = mood === 'level';
  // Marimba: offbeat chord stabs, plus a rolled chord on the downbeat.
  if (beat === 0) chord.notes.forEach((n, i) => marimba(ctx, hz(n), t + i * 0.02, 0.18));
  if (beat === 6 || beat === 10 || (full && beat === 14)) chord.notes.forEach((n) => marimba(ctx, hz(n + 12), t, 0.1));
  // Bass: root on 1, fifth on the "and" of 2, root again on 4.
  if (beat === 0 || beat === 12) bass(ctx, hz(chord.bass), t, 0.32);
  if (beat === 6) bass(ctx, hz(chord.bass + 7), t, 0.26);
  // Shaker on the offbeat 8ths, louder in levels.
  if (beat % 4 === 2) shaker(ctx, t, full ? 0.16 : 0.08);
  if (full && beat % 4 === 0) shaker(ctx, t, 0.05);
  if (full && (beat === 0 || beat === 8)) kick(ctx, t, 0.35);
  // Melody: a phrase every other two bars in the map, every two bars in levels.
  const phraseBar = Math.floor(s / 32) % 4;
  if (full || phraseBar % 2 === 0) {
    const phrase = PHRASES[phraseBar % 2];
    const n = phrase[s % 32];
    if (n !== null) steelDrum(ctx, hz(n, 523.25), t, full ? 0.13 : 0.1);
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
