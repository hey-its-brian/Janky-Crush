// The announcer: the phone's own text-to-speech, pitched low and slowed
// down so the callouts sound big and dramatic. Picks a deep English voice
// if the phone has one.
//
// iPhones only let a page speak once it has spoken during a tap, so
// primeVoice() speaks a silent word on touches until one has really
// started. Safari also drops an utterance spoken right after cancel(), and
// can lose one that nothing holds on to, so both are guarded against.

import { getSetting } from '../settings.js';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
// Deep-sounding voices found on iPhones and Macs, best first.
const PREFER = ['Rocko', 'Reed', 'Daniel', 'Aaron', 'Fred', 'Ralph', 'Eddy', 'Arthur', 'Alex'];

let voice = null;
let primed = false;
let current = null; // keeps the utterance alive until it finishes
let lastError = '';

function pickVoice() {
  const all = synth.getVoices().filter((v) => /^en/i.test(v.lang));
  for (const name of PREFER) {
    const v = all.find((x) => x.name.startsWith(name));
    if (v) return v;
  }
  return all[0] ?? null;
}

if (synth) synth.addEventListener?.('voiceschanged', () => (voice = null));

export function primeVoice() {
  if (primed || !synth || current) return;
  const u = new SpeechSynthesisUtterance('ready');
  u.volume = 0;
  u.onstart = u.onend = () => {
    primed = true;
    current = null;
  };
  u.onerror = () => (current = null);
  current = u;
  synth.speak(u);
}

function say(text) {
  voice ??= pickVoice();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? 'en-US';
  u.pitch = 0.5;
  u.rate = 0.8;
  u.volume = 1;
  u.onstart = () => (primed = true);
  u.onend = () => current === u && (current = null);
  u.onerror = (e) => {
    lastError = e.error || 'error';
    if (current === u) current = null;
  };
  current = u;
  synth.speak(u);
}

// Speak a callout. `force` ignores the Settings switch (for the test button).
export function announce(text, force = false) {
  if (!synth || (!force && !getSetting('voice'))) return;
  if (synth.speaking || synth.pending) {
    synth.cancel();
    setTimeout(() => say(text), 80);
  } else {
    say(text);
  }
}

// What the announcer is using, for the Settings screen.
export function voiceInfo() {
  if (!synth) return 'This browser has no speech';
  voice ??= pickVoice();
  const v = voice ? `${voice.name} (${voice.lang})` : 'no English voice found';
  return `Voice: ${v}${lastError ? ` · last error: ${lastError}` : ''}`;
}

// Don't keep talking while the app is in the background.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => document.hidden && synth?.cancel());
}
