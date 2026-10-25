// Instruments shared by the sound effects and the music. Each takes the
// audio context, an output node and a start time, so the same code plays
// live and renders offline for the previews.

// A glassy FM bell: a sine whose pitch is wobbled by another sine at a
// non-whole ratio. The wobble fades fast, so it rings bright then pure.
export function bell(ctx, out, freq, t, { dur = 0.9, vol = 0.2, ratio = 3.5, index = 2.4 } = {}) {
  const car = ctx.createOscillator();
  const mod = ctx.createOscillator();
  const depth = ctx.createGain();
  const g = ctx.createGain();
  car.frequency.value = freq;
  mod.frequency.value = freq * ratio;
  depth.gain.setValueAtTime(freq * index, t);
  depth.gain.exponentialRampToValueAtTime(freq * 0.02, t + dur * 0.5);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  mod.connect(depth).connect(car.frequency);
  car.connect(g).connect(out);
  car.start(t); mod.start(t);
  car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
}

// Glockenspiel / celesta: a few inharmonic partials, the high ones short.
const GLOCK = [[1, 1, 1], [2.76, 0.45, 0.45], [5.4, 0.22, 0.2], [8.93, 0.1, 0.1]];
export function glock(ctx, out, freq, t, { dur = 1, vol = 0.15 } = {}) {
  for (const [mult, v, d] of GLOCK) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freq * mult;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * v, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * d);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur * d + 0.05);
  }
}

// Plucked string (Karplus–Strong): a burst of noise fed round a short delay
// line that softens each time, which is how a real string rings down.
// Rendered once per pitch and kept.
const pluckCache = new WeakMap();
function pluckBuffer(ctx, freq, soft) {
  let cache = pluckCache.get(ctx);
  if (!cache) pluckCache.set(ctx, (cache = new Map()));
  const key = `${freq.toFixed(2)}:${soft}`;
  if (cache.has(key)) return cache.get(key);
  const sr = ctx.sampleRate;
  const n = Math.max(2, Math.floor(sr / freq - 0.5));
  const len = Math.floor(sr * 0.9);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  const ring = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) ring[i] = prev += (Math.random() * 2 - 1 - prev) * (1 - soft);
  let peak = 0;
  for (let i = 0, j = 0; i < len; i++) {
    const a = ring[j];
    const k = j + 1 === n ? 0 : j + 1;
    ring[j] = 0.996 * 0.5 * (a + ring[k]);
    d[i] = a;
    peak = Math.max(peak, Math.abs(a));
    j = k;
  }
  for (let i = 0; i < len; i++) d[i] /= peak || 1;
  const entry = { buf, rate: (freq * (n + 0.5)) / sr };
  cache.set(key, entry);
  return entry;
}

// soft 0..1: higher is rounder (more like a pizzicato), lower is twangier.
export function pluck(ctx, out, freq, t, { dur = 0.45, vol = 0.2, soft = 0.55 } = {}) {
  const { buf, rate } = pluckBuffer(ctx, freq, soft);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.setValueAtTime(vol, t + dur * 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(g).connect(out);
  src.start(t);
  src.stop(t + dur + 0.05);
}

// A bright brassy stab: two detuned saws through a filter that opens and
// closes with the note.
export function brass(ctx, out, freq, t, { dur = 0.5, vol = 0.1, bright = 3200 } = {}) {
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = 2;
  f.frequency.setValueAtTime(300, t);
  f.frequency.exponentialRampToValueAtTime(bright, t + 0.05);
  f.frequency.exponentialRampToValueAtTime(bright * 0.4, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
  g.gain.setValueAtTime(vol, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  f.connect(g).connect(out);
  for (const det of [-9, 9]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    o.detune.value = det;
    o.connect(f);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

// A soft string pad for held chords.
export function pad(ctx, out, freq, t, { dur = 1.6, vol = 0.04 } = {}) {
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1400;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + dur * 0.3);
  g.gain.setValueAtTime(vol, t + dur * 0.7);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  f.connect(g).connect(out);
  for (const det of [-7, 0, 7]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    o.detune.value = det;
    o.connect(f);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

// A made-up room for the reverb: stereo noise that dies away, darker as it
// goes. Gives everything a little sparkle and space.
export function makeRoom(ctx, seconds = 1.6) {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const k = i / len;
      lp += (Math.random() * 2 - 1 - lp) * (0.9 - 0.75 * k);
      d[i] = lp * (1 - k) ** 2.5;
    }
  }
  const conv = ctx.createConvolver();
  conv.buffer = buf;
  return conv;
}
