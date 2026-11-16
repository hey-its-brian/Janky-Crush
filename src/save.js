// Progress saved on the phone: two save files, Normal and Easy, each with
// its own levels, coins, boosters, lives, spin points and daily bonus. The mode is fixed
// when a save starts. Storage can be missing or blocked (private browsing),
// so every access is guarded and the game still runs; it just won't
// remember.

const KEY = 'janky-crush:save:v2';

// ---- the coin economy -------------------------------------------------------

export const MAX_LIVES = 5;
export const LIFE_REFILL_MS = 30 * 60 * 1000; // one life every 30 minutes
export const START_COINS = 100;
export const DAILY_COINS = 25;
export const PRICES = { smash: 30, switch: 40, shuffle: 20, sweep: 60, pick: 70, moves: 40, lives: 50 };
export const EXTRA_MOVES = 5;
export const BOOSTERS = ['smash', 'switch', 'shuffle', 'sweep', 'pick'];

// Coins for a win: a little for any win, more for each star you hadn't
// earned before on that level, and one per move you had left.
export const COINS_PER_WIN = 5;
export const COINS_PER_NEW_STAR = 10;
export const COINS_PER_MOVE_LEFT = 1;
export const MAX_MOVE_COINS = 10;

// ---- the prize wheel ----------------------------------------------------------

// The first win on each level gives one spin point. A spin costs 5 points
// on the small wheel and 10 on the grand wheel. Each wheel has 8 slices of
// the same size, so each prize has the same chance.
//
// Prizes: { type: 'booster', name, n }, { type: 'bundle', n } (n of every
// booster), { type: 'life', n } (a life refill to keep) and
// { type: 'coins', n }.
export const SPIN_COST = { small: 5, grand: 10 };
const one = (name) => ({ type: 'booster', name, n: 1 });
export const WHEELS = {
  small: [one('smash'), { type: 'coins', n: 25 }, one('sweep'), { type: 'life', n: 1 },
    one('switch'), { type: 'coins', n: 25 }, one('pick'), { type: 'bundle', n: 1 }],
  grand: [one('sweep'), { type: 'coins', n: 100 }, { type: 'bundle', n: 1 }, { type: 'life', n: 1 },
    one('pick'), { type: 'coins', n: 100 }, { type: 'bundle', n: 1 }, one('smash')],
};
// Easy mode has unlimited lives, so its wheels have two Shuffles there.
const NO_LIFE = { type: 'booster', name: 'shuffle', n: 2 };
export const wheelFor = (kind, easy) => WHEELS[kind].map((p) => (easy && p.type === 'life' ? NO_LIFE : p));

const today = (now = Date.now()) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

function newSlot(mode) {
  return {
    mode,
    levels: {},
    coins: START_COINS,
    boosters: { smash: 1, switch: 1, shuffle: 1, sweep: 1, pick: 1 },
    spins: 0,       // spin points for the prize wheel
    lifeRefills: 0, // life refills won on the wheel
    lives: MAX_LIVES,
    lifeAt: 0, // when the next life comes back (0 = full)
    daily: today(), // no daily bonus on the first day: the start coins cover it
  };
}

// A save from before the prize wheel: one spin point for each level
// already beaten, and one of each new booster to try.
function upgrade(slot) {
  if (!slot) return;
  slot.spins ??= Object.values(slot.levels).filter((l) => l.stars > 0).length;
  slot.lifeRefills ??= 0;
  for (const name of BOOSTERS) slot.boosters[name] ??= 1;
}

function blank() {
  return { version: 2, active: null, slots: { normal: null, easy: null } };
}

export function loadSave() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (data?.version === 2 && data.slots) {
      Object.values(data.slots).forEach(upgrade);
      return data;
    }
  } catch {
    // Unreadable or blocked: start fresh.
  }
  return blank();
}

// Two copies of the save (this phone's and iCloud's) made into one. For
// each save file: the levels keep the best stars and score from the two,
// and all the rest (coins, boosters, lives, spin points) comes from the
// copy that was saved last. Returns a new object.
export function mergeSaves(a, b) {
  if (!b) return a;
  if (!a) return b;
  const [older, newer] = (a.savedAt ?? 0) >= (b.savedAt ?? 0) ? [b, a] : [a, b];
  const out = structuredClone(newer);
  for (const mode of Object.keys({ ...older.slots, ...newer.slots })) {
    const o = older.slots[mode], n = out.slots[mode];
    if (!o) continue;
    if (!n) {
      out.slots[mode] = structuredClone(o);
      continue;
    }
    for (const [id, l] of Object.entries(o.levels)) {
      const have = n.levels[id] ?? { stars: 0, best: 0 };
      n.levels[id] = { stars: Math.max(have.stars, l.stars), best: Math.max(have.best, l.best) };
    }
  }
  Object.values(out.slots).forEach(upgrade);
  return out;
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
    Object.values(data.slots).forEach(upgrade);
  }

  // `onSave`, if set, gets the data after each save (the native app
  // sends it to iCloud).
  save() {
    this.data.savedAt = Date.now();
    write(this.data);
    this.onSave?.(this.data);
  }

  // Take in a copy of the save from iCloud: merge it with this one. The
  // save file in use stays the same. Returns true if anything changed.
  adopt(other) {
    const before = JSON.stringify(this.data);
    const active = this.data.active;
    const merged = mergeSaves(this.data, other);
    merged.active = active;
    if (JSON.stringify(merged) === before) return false;
    this.data = merged;
    write(this.data);
    return true;
  }

  // ---- save files ---------------------------------------------------------

  slotInfo(mode) {
    return this.data.slots[mode];
  }

  get active() {
    return this.data.active;
  }

  // Open a save file, starting it fresh if it's empty.
  use(mode) {
    this.data.slots[mode] ??= newSlot(mode);
    this.data.active = mode;
    this.save();
  }

  startOver(mode) {
    this.data.slots[mode] = newSlot(mode);
    this.data.active = mode;
    this.save();
  }

  get slot() {
    return this.data.slots[this.data.active];
  }

  get easy() {
    return this.slot.mode === 'easy';
  }

  // ---- levels -------------------------------------------------------------

  level(id) {
    return this.slot.levels[id] ?? { stars: 0, best: 0 };
  }

  // The highest level you can play: one past the furthest you've beaten.
  unlocked(slot = this.slot) {
    let n = 1;
    while (slot.levels[n]?.stars > 0) n++;
    return n;
  }

  totalStars(slot = this.slot) {
    return Object.values(slot.levels).reduce((sum, l) => sum + (l.stars ?? 0), 0);
  }

  // Record a win: keep the best stars and score, and pay out coins. The
  // first win on a level also gives a spin point. Returns the coins
  // earned, itemized for the results screen, and `spin` (0 or 1).
  recordWin(id, stars, score, movesLeft) {
    const prev = this.level(id);
    this.slot.levels[id] = { stars: Math.max(prev.stars, stars), best: Math.max(prev.best, score) };
    const earned = {
      win: COINS_PER_WIN,
      stars: Math.max(0, stars - prev.stars) * COINS_PER_NEW_STAR,
      moves: Math.min(MAX_MOVE_COINS, movesLeft * COINS_PER_MOVE_LEFT),
      spin: prev.stars > 0 ? 0 : 1,
    };
    earned.total = earned.win + earned.stars + earned.moves;
    this.slot.coins += earned.total;
    this.slot.spins += earned.spin;
    this.save();
    return earned;
  }

  // ---- coins and boosters ---------------------------------------------------

  get coins() {
    return this.slot.coins;
  }

  // Spend coins if there are enough. Returns whether it went through.
  spend(amount) {
    if (this.slot.coins < amount) return false;
    this.slot.coins -= amount;
    this.save();
    return true;
  }

  boosters(name) {
    return this.slot.boosters[name] ?? 0;
  }

  buyBooster(name) {
    if (!this.spend(PRICES[name])) return false;
    this.slot.boosters[name] = this.boosters(name) + 1;
    this.save();
    return true;
  }

  useBooster(name) {
    if (this.boosters(name) <= 0) return false;
    this.slot.boosters[name]--;
    this.save();
    return true;
  }

  // ---- the prize wheel -------------------------------------------------------

  get spins() {
    return this.slot.spins;
  }

  wheel(kind) {
    return wheelFor(kind, this.easy);
  }

  // Spin a wheel: pay the points, pick a slice and hand over its prize.
  // Returns { index, prize }, or null with too few points. `random` is a
  // function like Math.random.
  spin(kind, random = Math.random) {
    if (this.slot.spins < SPIN_COST[kind]) return null;
    const wheel = this.wheel(kind);
    const index = Math.min(wheel.length - 1, Math.floor(random() * wheel.length));
    const prize = wheel[index];
    this.slot.spins -= SPIN_COST[kind];
    const add = (name, n) => (this.slot.boosters[name] = this.boosters(name) + n);
    if (prize.type === 'booster') add(prize.name, prize.n);
    if (prize.type === 'bundle') for (const name of BOOSTERS) add(name, prize.n);
    if (prize.type === 'coins') this.slot.coins += prize.n;
    if (prize.type === 'life') this.slot.lifeRefills += prize.n;
    this.save();
    return { index, prize };
  }

  // Once a day: true if today's bonus was just paid.
  claimDaily(now = Date.now()) {
    if (this.slot.daily === today(now)) return false;
    this.slot.daily = today(now);
    this.slot.coins += DAILY_COINS;
    this.save();
    return true;
  }

  // ---- lives ------------------------------------------------------------------

  // Bring back lives that have refilled while away. Call before reading.
  tickLives(now = Date.now()) {
    const s = this.slot;
    if (s.mode === 'easy') return;
    let changed = false;
    while (s.lives < MAX_LIVES && s.lifeAt && now >= s.lifeAt) {
      s.lives++;
      s.lifeAt = s.lives < MAX_LIVES ? s.lifeAt + LIFE_REFILL_MS : 0;
      changed = true;
    }
    if (changed) this.save();
  }

  lives(now = Date.now()) {
    if (this.easy) return Infinity;
    this.tickLives(now);
    return this.slot.lives;
  }

  // Milliseconds until the next life, or 0 when full.
  nextLifeIn(now = Date.now()) {
    if (this.easy) return 0;
    this.tickLives(now);
    return this.slot.lifeAt ? Math.max(0, this.slot.lifeAt - now) : 0;
  }

  loseLife(now = Date.now()) {
    if (this.easy) return;
    this.tickLives(now);
    const s = this.slot;
    if (s.lives <= 0) return;
    s.lives--;
    if (!s.lifeAt) s.lifeAt = now + LIFE_REFILL_MS;
    this.save();
  }

  get lifeRefills() {
    return this.slot.lifeRefills;
  }

  // Use a life refill won on the wheel: all the lives come back.
  useLifeRefill() {
    if (this.easy || this.slot.lifeRefills <= 0 || this.slot.lives >= MAX_LIVES) return false;
    this.slot.lifeRefills--;
    this.slot.lives = MAX_LIVES;
    this.slot.lifeAt = 0;
    this.save();
    return true;
  }

  refillLives() {
    if (!this.spend(PRICES.lives)) return false;
    this.slot.lives = MAX_LIVES;
    this.slot.lifeAt = 0;
    this.save();
    return true;
  }
}
