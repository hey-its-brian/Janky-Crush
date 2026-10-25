// Haptic taps. Android browsers have navigator.vibrate. iPhone Safari
// doesn't, but since iOS 18 toggling a native switch control (<input
// type="checkbox" switch>) gives a light system haptic, and clicking its
// label from code does the same. That's the only haptic iPhone web apps can
// make: one light tick. It's most reliable inside a touch handler.

import { getSetting } from '../settings.js';

let label = null;

function iosSwitch() {
  if (label) return label;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.id = 'haptic-switch';
  input.tabIndex = -1;
  label = document.createElement('label');
  label.htmlFor = input.id;
  label.setAttribute('aria-hidden', 'true');
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-10px;top:-10px';
  box.append(input, label);
  document.body.append(box);
  return label;
}

let last = 0;

// strength: 1 = light tick, 2+ = a few ticks in a row (a heavier feel).
export function haptic(strength = 1) {
  if (!getSetting('haptics')) return;
  const now = performance.now();
  if (now - last < 40) return; // the phone can't render taps closer than this
  last = now;
  if (navigator.vibrate) {
    navigator.vibrate(strength > 1 ? [18, 30, 18, 30, 24].slice(0, strength * 2 - 1) : 12);
    return;
  }
  const l = iosSwitch();
  l.click();
  for (let i = 1; i < strength; i++) setTimeout(() => l.click(), i * 70);
}
