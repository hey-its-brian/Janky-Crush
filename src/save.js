// Progress saved on the phone. Split into save files ("normal" now, "easy"
// in Phase 4) so each mode keeps its own levels. Storage can be missing or
// blocked (private browsing), so every access is guarded and the game still
// runs; it just won't remember.

const KEY = 'janky-crush:save:v1';

function blank() {
  return { version: 1, slot: 'normal', slots: { normal: { levels: {} } } };
}

export function loadSave() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (data?.version === 1 && data.slots) return data;
  } catch {
    // Unreadable or blocked: start fresh.
  }
  return blank();
}

function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Full or blocked: keep playing without saving.
  }
}

export class Progress {
  constructor(data = loadSave()) {
    this.data = data;
  }

  get slot() {
    const name = this.data.slot;
    this.data.slots[name] ??= { levels: {} };
    return this.data.slots[name];
  }

  level(id) {
    return this.slot.levels[id] ?? { stars: 0, best: 0 };
  }

  // The highest level you can play: one past the furthest you've beaten.
  unlocked() {
    let n = 1;
    while (this.slot.levels[n]?.stars > 0) n++;
    return n;
  }

  totalStars() {
    return Object.values(this.slot.levels).reduce((sum, l) => sum + (l.stars ?? 0), 0);
  }

  // Keep the best stars and score seen for a level.
  record(id, stars, score) {
    const prev = this.level(id);
    this.slot.levels[id] = { stars: Math.max(prev.stars, stars), best: Math.max(prev.best, score) };
    write(this.data);
  }
}
