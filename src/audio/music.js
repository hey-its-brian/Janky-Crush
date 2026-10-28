// Background music, played live with Web Audio: three warm, easygoing songs
// in the same island style. The map plays "Lazy Springs"; levels take turns
// through all three. Everything goes through a gentle lowpass so nothing is
// shrill. Notes are scheduled a little ahead on a timer, the usual way to
// keep Web Audio music in time.
//
// Each song is eight bars of chords with a tune, then a sparser answer the
// second time round, so it never feels busy. Steps are eighth notes. Tones
// are semitones from C4; bass roots are semitones from C2.

import { audioContext, musicOutput, onUnlock } from './sfx.js';
import { pluck, epiano, reed, softBass, marimba, vibes, softened } from './synth.js';

const AHEAD = 0.15;
const hz = (semi, root) => root * 2 ** (semi / 12);
const C2 = 65.41, C4 = 261.63;

// ---- shared percussion ---------------------------------------------------------

// A soft, low kick.
function kick(ctx, out, t, vol) {
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
function rim(ctx, out, t, vol) {
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

// A dub echo for a melody line, a set number of steps long, fading.
const echoes = new WeakMap();
function echo(ctx, out, seconds) {
  let byOut = echoes.get(ctx);
  if (!byOut) echoes.set(ctx, (byOut = new Map()));
  const keyed = `${seconds.toFixed(4)}`;
  let e = byOut.get(keyed);
  if (e && e.out === out) return e.input;
  const input = ctx.createGain();
  input.gain.value = 0.35;
  const delay = ctx.createDelay(2);
  delay.delayTime.value = seconds;
  const fb = ctx.createGain();
  fb.gain.value = 0.35;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 1500;
  input.connect(delay).connect(tone).connect(fb).connect(delay);
  tone.connect(out);
  byOut.set(keyed, (e = { input, out }));
  return e.input;
}

// Notes of the tune for this bar and step: the tune the first time round,
// the answer the second.
function tuneAt(song, bar, beat) {
  const second = Math.floor(bar / song.chords.length) % 2 === 1;
  const line = (second ? song.answer : song.melody)[bar % song.chords.length];
  return { second, notes: line.filter(([at]) => at === beat).map(([, n]) => n) };
}

// ---- the songs -------------------------------------------------------------------

// Lazy Springs: an "um-pa-pa" in 3/4. A round bass on the beat, soft guitar
// and electric piano on the two after it, and a low melodica with a dub echo.
const LAZY = {
  name: 'Lazy Springs', bpm: 105, bar: 6, swing: 0,
  chords: [
    { notes: [-5, -1, 4], bass: 12 },  // Cmaj7
    { notes: [-5, 0, 4], bass: 9 },    // Am7
    { notes: [-3, 0, 5], bass: 14 },   // Dm7
    { notes: [-7, -1, 5], bass: 7 },   // G7
    { notes: [-5, -1, 2], bass: 16 },  // Em7
    { notes: [-5, 1, 4], bass: 9 },    // A7
    { notes: [-3, 0, 5], bass: 14 },   // Dm7
    { notes: [-7, -1, 2], bass: 7 },   // G7
  ],
  melody: [
    [[0, 7], [4, 11]], [[0, 9], [4, 7]], [[0, 5], [2, 9], [4, 12]], [[0, 11]],
    [[0, 7], [4, 11]], [[0, 13], [2, 9], [4, 7]], [[0, 9], [4, 5]], [[0, 2], [2, 5], [4, 7]],
  ],
  answer: [[[2, 4]], [[2, 0]], [[2, 2]], [[2, -1]], [[2, 4]], [[2, 1]], [[2, 5]], [[2, 2]]],
  play(ctx, out, chord, bar, beat, t, step) {
    if (beat === 0) {
      softBass(ctx, out, hz(chord.bass - 12, C2), t, { dur: 0.9, vol: 0.34 });
      kick(ctx, out, t, 0.22);
    }
    if (beat === 5) softBass(ctx, out, hz(chord.bass - 5, C2), t, { dur: 0.3, vol: 0.14 });
    if (beat === 2 || beat === 4) {
      chord.notes.forEach((n, i) => pluck(ctx, out, hz(n, C4), t + i * 0.015, { vol: beat === 2 ? 0.08 : 0.065, dur: 0.5, soft: 0.85 }));
      chord.notes.forEach((n) => epiano(ctx, out, hz(n, C4), t, { dur: 0.45, vol: 0.035 }));
      rim(ctx, out, t, 0.04);
    }
    const { second, notes } = tuneAt(this, bar, beat);
    for (const n of notes) {
      reed(ctx, out, hz(n, C4), t, { dur: step * 3, vol: second ? 0.03 : 0.045 });
      reed(ctx, echo(ctx, out, step * 3), hz(n, C4), t, { dur: step * 3, vol: 0.03 });
    }
  },
};

// Coconut Shuffle: a laid-back ska shuffle in 4/4. A walking bass, offbeat
// guitar chops, a backbeat rim and a marimba tune, all with a lazy swing.
const MAJOR = [0, 4, 7, 9], MINOR = [0, 3, 7, 10], DOM = [0, 4, 7, 10];
const SHUFFLE = {
  name: 'Coconut Shuffle', bpm: 112, bar: 8, swing: 0.32,
  chords: [
    { notes: [-3, 2, 5], bass: 5, walk: MAJOR },    // F6
    { notes: [-3, 0, 5], bass: 2, walk: MINOR },    // Dm7
    { notes: [-2, 2, 5], bass: 7, walk: MINOR },    // Gm7
    { notes: [-2, 0, 4], bass: 12, walk: DOM },     // C7
    { notes: [-3, 2, 5], bass: 5, walk: MAJOR },    // F6
    { notes: [-3, 0, 6], bass: 2, walk: DOM },      // D7
    { notes: [-2, 2, 5], bass: 7, walk: MINOR },    // Gm7
    { notes: [-2, 0, 4], bass: 12, walk: DOM },     // C7
  ],
  melody: [
    [[0, 9], [2, 12], [3, 14], [4, 12], [6, 9]],
    [[0, 5], [3, 9], [4, 12]],
    [[0, 10], [2, 9], [3, 7], [4, 10], [6, 14]],
    [[0, 12], [4, 10], [6, 7]],
    [[0, 9], [2, 12], [3, 14], [4, 17], [6, 14]],
    [[0, 12], [3, 9], [4, 6], [6, 9]],
    [[0, 7], [2, 10], [4, 12], [6, 10]],
    [[0, 9], [2, 5]],
  ],
  answer: [[[4, 9]], [[4, 5]], [[4, 10]], [[4, 7]], [[4, 12]], [[4, 9]], [[4, 10]], [[2, 7], [4, 5]]],
  play(ctx, out, chord, bar, beat, t) {
    // Walking bass on every beat.
    if (beat % 2 === 0) softBass(ctx, out, hz(chord.bass + chord.walk[beat / 2], C2), t, { dur: 0.32, vol: beat === 0 ? 0.32 : 0.24 });
    // Chops on the "and"s: short, muted strums.
    if (beat % 2 === 1) {
      chord.notes.forEach((n, i) => pluck(ctx, out, hz(n + 12, C4), t + i * 0.008, { vol: 0.055, dur: 0.14, soft: 0.5 }));
      epiano(ctx, out, hz(chord.notes[1], C4), t, { dur: 0.18, vol: 0.03 });
    }
    if (beat === 0 || beat === 4) kick(ctx, out, t, 0.2);
    if (beat === 2 || beat === 6) rim(ctx, out, t, 0.05);
    const { second, notes } = tuneAt(this, bar, beat);
    for (const n of notes) marimba(ctx, out, hz(n, C4), t, { dur: 0.7, vol: second ? 0.1 : 0.15 });
  },
};

// Lantern Polka: a bouncy "oom-pah" in 4/4 with ukulele strums and a
// vibraphone tune.
const POLKA = {
  name: 'Lantern Polka', bpm: 108, bar: 8, swing: 0.12,
  chords: [
    { notes: [-1, 2, 7], bass: 7 },    // G
    { notes: [-1, 4, 7], bass: 4 },    // Em
    { notes: [0, 4, 7], bass: 12 },    // C
    { notes: [0, 2, 6], bass: 2 },     // D7
    { notes: [-1, 2, 7], bass: 7 },    // G
    { notes: [-3, 3, 6], bass: 11 },   // B7
    { notes: [-1, 4, 7], bass: 4 },    // Em
    { notes: [0, 2, 6], bass: 2 },     // D7
  ],
  melody: [
    [[0, 11], [2, 14], [4, 11], [6, 7]],
    [[0, 16], [3, 14], [4, 11]],
    [[0, 12], [2, 16], [4, 14], [6, 12]],
    [[0, 14], [4, 9]],
    [[0, 11], [2, 14], [4, 19]],
    [[0, 18], [2, 15], [4, 11]],
    [[0, 16], [2, 14], [4, 12], [6, 11]],
    [[0, 9], [2, 11], [4, 7]],
  ],
  answer: [[[4, 7]], [[4, 11]], [[4, 12]], [[4, 9]], [[4, 14]], [[4, 15]], [[4, 11]], [[2, 9], [4, 7]]],
  play(ctx, out, chord, bar, beat, t) {
    // Oom: root on 1, fifth on 3. Pah: a ukulele strum and piano on 2 and 4.
    if (beat === 0) softBass(ctx, out, hz(chord.bass, C2), t, { dur: 0.4, vol: 0.32 });
    if (beat === 4) softBass(ctx, out, hz(chord.bass + 7, C2), t, { dur: 0.4, vol: 0.26 });
    if (beat === 2 || beat === 6) {
      chord.notes.forEach((n, i) => pluck(ctx, out, hz(n + 12, C4), t + i * 0.012, { vol: 0.065, dur: 0.3, soft: 0.6 }));
      chord.notes.forEach((n) => epiano(ctx, out, hz(n, C4), t, { dur: 0.3, vol: 0.03 }));
      rim(ctx, out, t, 0.04);
    }
    if (beat === 0 || beat === 4) kick(ctx, out, t, 0.18);
    // A little pickup strum before each "pah".
    if (beat === 5) pluck(ctx, out, hz(chord.notes[2] + 12, C4), t, { vol: 0.04, dur: 0.12, soft: 0.6 });
    const { second, notes } = tuneAt(this, bar, beat);
    for (const n of notes) vibes(ctx, out, hz(n, C4), t, { dur: 1.2, vol: second ? 0.07 : 0.1 });
  },
};

export const SONGS = [LAZY, SHUFFLE, POLKA];

// Which song a level plays: they take turns.
export const songFor = (levelId) => (levelId - 1) % SONGS.length;

// ---- playing ------------------------------------------------------------------------

let timer = null;
let nextTime = 0;
let step = 0;
let song = LAZY;
let pending = null; // the song to switch to at the next bar line
let bus = null;     // the music bus
let out = null;     // where instruments play: the bus through a soft lowpass

const stepLength = (s) => 60 / s.bpm / 2;

function scheduleStep(ctx, s, n, t) {
  const bar = Math.floor(n / s.bar);
  const beat = n % s.bar;
  // Swing: the offbeat eighths lean a little late.
  const at = t + (beat % 2 ? s.swing * stepLength(s) : 0);
  s.play(ctx, out, s.chords[bar % s.chords.length], bar, beat, at, stepLength(s));
}

function tick() {
  const ctx = audioContext();
  if (!ctx || ctx.state !== 'running') return;
  if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
  while (nextTime < ctx.currentTime + AHEAD) {
    if (pending && step % song.bar === 0) {
      song = pending;
      pending = null;
      step = 0;
    }
    scheduleStep(ctx, song, step, nextTime);
    nextTime += stepLength(song);
    step++;
  }
}

// Start the music, or switch songs (at the next bar line, so it doesn't
// stumble). `which` is an index into SONGS. Waits for the first tap.
export function playMusic(which = 0) {
  const next = SONGS[which] ?? LAZY;
  onUnlock((ctx) => {
    bus ??= musicOutput();
    out ??= softened(ctx, bus, 2400);
    if (timer) {
      pending = next === song ? null : next;
      return;
    }
    song = next;
    nextTime = ctx.currentTime + 0.1;
    step = 0;
    timer = setInterval(tick, 25);
  });
}

export function stopMusic() {
  clearInterval(timer);
  timer = null;
}

// Render `seconds` of a song into an offline context (tools only).
export function renderMusic(off, output, seconds, which = 0) {
  const saved = out;
  out = softened(off, output, 2400);
  const s = SONGS[which];
  for (let t = 0.05, n = 0; t < seconds; t += stepLength(s), n++) scheduleStep(off, s, n, t);
  out = saved;
}
