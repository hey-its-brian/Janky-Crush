// Haptic taps. Android browsers have navigator.vibrate. iPhone Safari
// doesn't; its only haptic for web apps is the light tick a native switch
// control (<input type="checkbox" switch>) gives when it toggles.
//
// Up to iOS 26.4 a switch toggled from code ticked too, so haptic() can
// buzz for matches and explosions. Newer iOS only ticks when a finger
// really toggles a switch, so tactile() also lays an invisible switch over
// each button and wraps the board in a switch's label: every real tap
// toggles it and ticks, and the tap still reaches the button or board.

import { getSetting, onSettingChange } from '../settings.js';

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

// ---- real-tap switches (iPhone) ---------------------------------------------

const isIos = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function makeSwitch() {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.className = 'tap-switch';
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');
  return input;
}

// An invisible switch covering a button: the finger toggles it (tick) and
// the click bubbles on to the button as usual.
function cover(el) {
  if (el.querySelector(':scope > .tap-switch')) return;
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  el.append(makeSwitch());
}

// Wrap an element (the board) in a label for a hidden switch: taps on it
// toggle the switch, while drags and swipes go to the element untouched.
function wrapInLabel(el) {
  const input = makeSwitch();
  input.id = `tap-${el.id}`;
  input.classList.add('hidden-switch');
  const wrap = document.createElement('label');
  wrap.htmlFor = input.id;
  wrap.className = 'tap-label';
  el.replaceWith(wrap);
  wrap.append(el, input);
}

const TAPPABLE = 'button, .node:not(.locked)';

export function tactile(boardEl) {
  if (!isIos) return;
  const update = () => document.documentElement.classList.toggle('no-haptics', !getSetting('haptics'));
  update();
  onSettingChange((name) => name === 'haptics' && update());
  if (boardEl) wrapInLabel(boardEl);
  document.querySelectorAll(TAPPABLE).forEach(cover);
  new MutationObserver((records) => {
    for (const r of records) {
      for (const n of r.addedNodes) {
        if (n.nodeType !== 1 || n.classList.contains('tap-switch')) continue;
        if (n.matches(TAPPABLE)) cover(n);
        n.querySelectorAll?.(TAPPABLE).forEach(cover);
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
}
