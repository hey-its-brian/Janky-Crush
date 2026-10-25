// Player settings (sound, music, announcer voice, haptics), saved on the phone. Like the save
// file, storage may be blocked, so reads and writes are guarded.

const KEY = 'janky-crush:settings:v1';
const DEFAULTS = { sfx: true, music: true, voice: true, haptics: true };

let current = { ...DEFAULTS };
try {
  current = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY)) };
} catch {
  // Unreadable or blocked: defaults.
}

const listeners = new Set();

export function getSetting(name) {
  return current[name];
}

export function setSetting(name, value) {
  current[name] = value;
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Keep going without saving.
  }
  for (const fn of listeners) fn(name, value);
}

export function onSettingChange(fn) {
  listeners.add(fn);
}
