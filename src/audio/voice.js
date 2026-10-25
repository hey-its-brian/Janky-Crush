// The announcer: the phone's own text-to-speech, pitched low and slowed
// down so the callouts sound big and dramatic. Picks a deep English voice
// if the phone has one. Like audio, iPhones only let it speak after a tap,
// so primeVoice() runs on the first touch.

import { getSetting } from '../settings.js';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
// Deep-sounding voices found on iPhones and Macs, best first.
const PREFER = ['Rocko', 'Reed', 'Daniel', 'Aaron', 'Fred', 'Ralph', 'Eddy', 'Arthur', 'Alex'];

let voice = null;
let primed = false;

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
  if (primed || !synth) return;
  primed = true;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  synth.speak(u);
}

export function announce(text) {
  if (!synth || !getSetting('voice')) return;
  synth.cancel();
  voice ??= pickVoice();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.pitch = 0.5;
  u.rate = 0.8;
  u.volume = 1;
  synth.speak(u);
}

// Don't keep talking while the app is in the background.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => document.hidden && synth?.cancel());
}
