// Background music: slow and calming, played live with Web Audio. One
// mellow jazz theme in two grooves: a bossa nova on the map (nylon guitar,
// vibraphone, soft bass, rim clicks) and a slow reggae one-drop in levels
// (offbeat skank, electric piano, melodica with a dub echo). Notes are
// scheduled a little ahead on a timer, the usual way to keep Web Audio
// music in time.

import { audioContext, musicOutput, onUnlock } from './sfx.js';
import { pluck, epiano, vibes, reed, softBass } from './synth.js';

const BPM = 74;
const STEP = 60 / BPM / 4; // a 16th note
const BAR = 16;
const AHEAD = 0.15;

// Eight bars of soft seventh chords. Tones are semitones from C4; the bass
// root is from C3.
const CHORDS = [
  { name: 'Cmaj7', notes: [-1, 4, 7, 12], bass: 0 },
  { name: 'Am7', notes: [-5, 0, 4, 7], bass: -3 },
  { name: 'Dm7', notes: [0, 2, 5, 9], bass: 2 },
  { name: 'G9', notes: [-1, 2, 5, 9], bass: -5 },
  { name: 'Em7', notes: [-1, 2, 4, 7], bass: 4 },
  { name: 'A7', notes: [-3, 1, 4, 7], bass: -3 },
  { name: 'Dm7', notes: [0, 2, 5, 9], bass: 2 },
  { name: 'G9', notes: [-1, 2, 5, 9], bass: -5 },
];

// The tune: long, unhurried notes. [16th step, semitones above C5] per bar.
const MELODY = [
  [[0, 11], [6, 9], [10, 7]],
  [[0, 4], [12, 7]],
  [[0, 9], [6, 7], [10, 5]],
  [[0, 2], [12, -1]],
  [[0, 7], [6, 11], [10, 14]],
  [[0, 13], [6, 9], [10, 7]],
  [[0, 5], [6, 9], [10, 12]],
  [[0, 11], [8, 9], [12, 7]],
];
// Second time round, a sparser answer so it never feels busy.
const ANSWER = [
  [[4, 7]], [[4, 12]], [[4, 9]], [[8, 11]],
  [[4, 11]], [[4, 9]], [[4, 5]], [[8, 2]],
];

const hz = (semi, root) => root * 2 ** (semi / 12);
const C3 = 130.81, C4 = 261.63, C5 = 523.25;

let mood = null;
let timer = null;
let nextTime = 0;
let step = 0;
let out = null;

// A dub echo for the reggae skank and melodica: three 16ths, fading.
const echoes = new WeakMap();
function echo(ctx) {
  let e = echoes.get(ctx);
  if (e && e.out === out) return e.input;
  const input = ctx.createGain();
  input.gain.value = 0.35;
  const delay = ctx.createDelay(1);
  delay.delayTime.value = STEP * 3;
  const fb = ctx.createGain();
  fb.gain.value = 0.38;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 1800;
  input.connect(delay).connect(tone).connect(fb).connect(delay);
  tone.connect(out);
  echoes.set(ctx, (e = { input, out }));
  return input;
}

let noiseBuf = null;
function tick16(ctx, t, { vol, freq = 7000, dur = 0.05 }) {
  if (!noiseBuf || noiseBuf.sampleRate !== ctx.sampleRate) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + dur + 0.02);
}

// A wooden rim click.
function rim(ctx, t, vol) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.value = 1700;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.05);
  tick16(ctx, t, { vol: vol * 0.5, freq: 3000, dur: 0.02 });
}

// A soft, low kick.
function kick(ctx, t, vol) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(95, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.32);
}

// Bossa nova: guitar comping on the clave, "boom… ba-boom" bass.
const BOSSA_COMP = [[0, 3, 6, 10, 13], [2, 6, 8, 12]];
function bossa(ctx, s, t, chord, beat, bar) {
  if (BOSSA_COMP[bar % 2].includes(beat)) {
    chord.notes.forEach((n, i) => pluck(ctx, out, hz(n, C4), t + i * 0.012, { vol: 0.07, dur: 0.5, soft: 0.75 }));
  }
  if (beat === 0) softBass(ctx, out, hz(chord.bass, C3 / 2), t, { dur: 0.9, vol: 0.3 });
  if (beat === 6) softBass(ctx, out, hz(chord.bass, C3 / 2), t, { dur: 0.25, vol: 0.18 });
  if (beat === 8) softBass(ctx, out, hz(chord.bass + 7, C3 / 2), t, { dur: 0.9, vol: 0.26 });
  if (beat === 14) softBass(ctx, out, hz(chord.bass + 7, C3 / 2), t, { dur: 0.25, vol: 0.16 });
  if (beat === 0 || beat === 8) kick(ctx, t, 0.16);
  if ([0, 3, 6, 10, 13].includes(beat) && bar % 2 === 0) rim(ctx, t, 0.05);
  if ([4, 10].includes(beat) && bar % 2 === 1) rim(ctx, t, 0.05);
  tick16(ctx, t, { vol: beat % 4 === 2 ? 0.035 : 0.015 }); // a soft shaker
}

// Reggae one-drop: the kick and rim land on beat three, the skank on two
// and four, the bass rolls in after the downbeat.
function reggae(ctx, s, t, chord, beat) {
  const fx = echo(ctx);
  if (beat === 4 || beat === 12) {
    chord.notes.forEach((n) => {
      pluck(ctx, out, hz(n + 12, C4), t, { vol: 0.05, dur: 0.12, soft: 0.2 });
      epiano(ctx, out, hz(n, C4), t, { dur: 0.35, vol: 0.05 });
    });
    epiano(ctx, fx, hz(chord.notes[2], C4), t, { dur: 0.3, vol: 0.06 });
  }
  const line = { 2: 0, 6: 0, 8: 7, 11: 12, 14: 7 };
  if (beat in line) softBass(ctx, out, hz(chord.bass + line[beat], C3 / 2), t, { dur: beat === 8 ? 0.5 : 0.3, vol: 0.32 });
  if (beat === 8) { kick(ctx, t, 0.26); rim(ctx, t, 0.08); }
  // Hi-hat eighths with a lazy swing.
  if (beat % 2 === 0) tick16(ctx, t + (beat % 4 === 2 ? STEP * 0.3 : 0), { vol: beat % 4 === 2 ? 0.03 : 0.018 });
}

function scheduleStep(ctx, s, t) {
  const bar = Math.floor(s / BAR);
  const beat = s % BAR;
  const chord = CHORDS[bar % CHORDS.length];
  const level = mood === 'level';
  if (level) reggae(ctx, s, t, chord, beat);
  else bossa(ctx, s, t, chord, beat, bar);
  // The tune, then a quieter answer the second time through.
  const second = Math.floor(bar / CHORDS.length) % 2 === 1;
  for (const [at, n] of (second ? ANSWER : MELODY)[bar % CHORDS.length]) {
    if (at !== beat) continue;
    if (level) {
      reed(ctx, out, hz(n, C5), t, { dur: STEP * 5, vol: second ? 0.03 : 0.045 });
      reed(ctx, echo(ctx), hz(n, C5), t, { dur: STEP * 5, vol: 0.03 });
    } else {
      vibes(ctx, out, hz(n, C5), t, { dur: 2.2, vol: second ? 0.07 : 0.1 });
    }
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
