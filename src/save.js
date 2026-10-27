// Progress saved on the phone: two save files, Normal and Easy, each with
// its own levels, coins, boosters, lives and daily bonus. The mode is fixed
// when a save starts. Storage can be missing or blocked (private browsing),
// so every access is guarded and the game still runs; it just won't
// remember.

const KEY = 'janky-crush:save:v2';

// ---- the coin economy -------------------------------------------------------

export const MAX_LIVES = 5;
export const LIFE_REFILL_MS = 30 * 60 * 1000; // one life every 30 minutes
export const START_COINS = 100;
export const DAILY_COINS = 25;
export const PRICES = { smash: 30, switch: 40, shuffle: 20, moves: 40, lives: 50 };
export const EXTRA_MOVES = 5;
export const BOOSTERS = ['smash', 'switch', 'shuffle'];

// Coins for a win: a little for any win, more for each star you hadn't
// earned before on that level, and one per move you had left.
export const COINS_PER_WIN = 5;
export const COINS_PER_NEW_STAR = 10;
export const COINS_PER_MOVE_LEFT = 1;
export const MAX_MOVE_COINS = 10;

const today = (now = Date.now()) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

function newSlot(mode) {
  return {
    mode,
    levels: {},
    coins: START_COINS,
    boosters: { smash: 1, switch: 1, shuffle: 1 },
    lives: MAX_LIVES,
    lifeAt: 0, // when the next life comes back (0 = full)
    daily: today(), // no daily bonus on the first day: the start coins cover it
  };
}

function blank() {
  return { version: 2, active: null, slots: { normal: null, easy: null } };
}

export function loadSave() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (data?.version === 2 && data.slots) return data;
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

  save() {
    write(this.data);
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

  // Record a win: keep the best stars and score, and pay out coins.
  // Returns the coins earned, itemized for the results screen.
  recordWin(id, stars, score, movesLeft) {
    const prev = this.level(id);
    this.slot.levels[id] = { stars: Math.max(prev.stars, stars), best: Math.max(prev.best, score) };
    const earned = {
      win: COINS_PER_WIN,
      stars: Math.max(0, stars - prev.stars) * COINS_PER_NEW_STAR,
      moves: Math.min(MAX_MOVE_COINS, movesLeft * COINS_PER_MOVE_LEFT),
    };
    earned.total = earned.win + earned.stars + earned.moves;
    this.slot.coins += earned.total;
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

  refillLives() {
    if (!this.spend(PRICES.lives)) return false;
    this.slot.lives = MAX_LIVES;
    this.slot.lifeAt = 0;
    this.save();
    return true;
  }
}
