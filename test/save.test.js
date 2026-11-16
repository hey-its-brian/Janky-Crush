import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeSaves, Progress, MAX_LIVES, LIFE_REFILL_MS, PRICES, START_COINS, DAILY_COINS, BOOSTERS, SPIN_COST, WHEELS } from '../src/save.js';

const fresh = (mode = 'normal') => {
  const p = new Progress({ version: 2, active: null, slots: { normal: null, easy: null } });
  p.use(mode);
  return p;
};

test('a new save starts with coins, full lives and one of each booster', () => {
  const p = fresh();
  assert.equal(p.coins, START_COINS);
  assert.equal(p.lives(), MAX_LIVES);
  assert.equal(p.boosters('smash'), 1);
});

test('lives come back one at a time on the timer', () => {
  const p = fresh();
  const t = 1_000_000;
  p.loseLife(t);
  p.loseLife(t + 1000);
  assert.equal(p.lives(t + 2000), MAX_LIVES - 2);
  assert.equal(p.lives(t + LIFE_REFILL_MS), MAX_LIVES - 1);
  assert.equal(p.lives(t + LIFE_REFILL_MS * 2), MAX_LIVES);
  assert.equal(p.nextLifeIn(t + LIFE_REFILL_MS * 2), 0);
});

test('easy saves never run out of lives', () => {
  const p = fresh('easy');
  for (let i = 0; i < 10; i++) p.loseLife();
  assert.equal(p.lives(), Infinity);
});

test('the two save files are separate', () => {
  const p = fresh('normal');
  p.recordWin(1, 3, 5000, 4);
  p.use('easy');
  assert.equal(p.unlocked(), 1);
  assert.equal(p.coins, START_COINS);
  p.use('normal');
  assert.equal(p.unlocked(), 2);
});

test('wins pay for new stars only, plus leftover moves', () => {
  const p = fresh();
  const first = p.recordWin(1, 2, 3000, 3);
  assert.deepEqual(first, { win: 5, stars: 20, moves: 3, spin: 1, total: 28 });
  const again = p.recordWin(1, 3, 4000, 0);
  assert.equal(again.stars, 10);
  const same = p.recordWin(1, 3, 4000, 50);
  assert.equal(same.stars, 0);
  assert.equal(same.moves, 10); // capped
});

test('buying needs enough coins', () => {
  const p = fresh();
  p.slot.coins = PRICES.smash - 1;
  assert.equal(p.buyBooster('smash'), false);
  p.slot.coins = PRICES.smash;
  assert.equal(p.buyBooster('smash'), true);
  assert.equal(p.boosters('smash'), 2);
  assert.equal(p.coins, 0);
});

test('the daily bonus pays once a day', () => {
  const p = fresh();
  const tomorrow = Date.now() + 26 * 3600 * 1000;
  assert.equal(p.claimDaily(), false); // not on the day the save starts
  assert.equal(p.claimDaily(tomorrow), true);
  assert.equal(p.claimDaily(tomorrow), false);
  assert.equal(p.coins, START_COINS + DAILY_COINS);
});

// ---- the prize wheel ----------------------------------------------------------

test('only the first win on a level gives a spin point', () => {
  const p = fresh();
  assert.equal(p.spins, 0);
  p.recordWin(1, 1, 1000, 0);
  p.recordWin(1, 3, 2000, 0);
  p.recordWin(2, 2, 1000, 0);
  assert.equal(p.spins, 2);
});

test('a save from before the wheel gets a point for each level beaten and one of each new booster', () => {
  const old = { mode: 'normal', levels: { 1: { stars: 3, best: 1 }, 2: { stars: 1, best: 1 }, 3: { stars: 0, best: 0 } }, coins: 10, boosters: { smash: 0, switch: 2, shuffle: 1 }, lives: 5, lifeAt: 0, daily: '' };
  const p = new Progress({ version: 2, active: 'normal', slots: { normal: old, easy: null } });
  assert.equal(p.spins, 2);
  assert.equal(p.lifeRefills, 0);
  assert.equal(p.boosters('smash'), 0);
  assert.equal(p.boosters('sweep'), 1);
  assert.equal(p.boosters('pick'), 1);
  // Only once.
  const again = new Progress(p.data);
  assert.equal(again.spins, 2);
});

test('a spin costs its points and needs enough of them', () => {
  const p = fresh();
  p.slot.spins = 12;
  assert.ok(p.spin('small', () => 0));
  assert.equal(p.spins, 12 - SPIN_COST.small);
  assert.equal(p.spin('grand', () => 0), null);
  assert.equal(p.spins, 7);
});

test('every slice of both wheels pays its prize', () => {
  for (const kind of ['small', 'grand']) {
    WHEELS[kind].forEach((prize, i) => {
      const p = fresh();
      p.slot.spins = 10;
      const before = { coins: p.coins, life: p.lifeRefills, boosters: Object.fromEntries(BOOSTERS.map((b) => [b, p.boosters(b)])) };
      const won = p.spin(kind, () => (i + 0.5) / WHEELS[kind].length);
      assert.equal(won.index, i);
      assert.deepEqual(won.prize, prize);
      if (prize.type === 'coins') assert.equal(p.coins, before.coins + prize.n);
      if (prize.type === 'life') assert.equal(p.lifeRefills, before.life + 1);
      if (prize.type === 'booster') assert.equal(p.boosters(prize.name), before.boosters[prize.name] + prize.n);
      if (prize.type === 'bundle') for (const b of BOOSTERS) assert.equal(p.boosters(b), before.boosters[b] + 1);
    });
  }
});

test('the wheels have 8 slices, and the grand wheel is the better one', () => {
  const worth = (w) => w.reduce((sum, p) => sum + (p.type === 'bundle' ? 5 : p.type === 'coins' ? p.n / 50 : 1), 0);
  assert.equal(WHEELS.small.length, 8);
  assert.equal(WHEELS.grand.length, 8);
  assert.ok(worth(WHEELS.grand) > worth(WHEELS.small) * 1.5);
});

test('an easy save has no life refill on its wheels', () => {
  const p = fresh('easy');
  for (const kind of ['small', 'grand']) assert.ok(p.wheel(kind).every((x) => x.type !== 'life'));
});

test('a life refill brings back all the lives, and is kept until it is needed', () => {
  const p = fresh();
  p.slot.lifeRefills = 1;
  assert.equal(p.useLifeRefill(), false); // lives are full
  assert.equal(p.lifeRefills, 1);
  for (let i = 0; i < MAX_LIVES; i++) p.loseLife(1000);
  assert.equal(p.lives(2000), 0);
  assert.ok(p.useLifeRefill());
  assert.equal(p.lives(2000), MAX_LIVES);
  assert.equal(p.lifeRefills, 0);
  assert.equal(p.useLifeRefill(), false);
});

// ---- two copies of the save (this phone and iCloud) ---------------------------

const copyOf = (p) => JSON.parse(JSON.stringify(p.data));

test('a save gets the time of each save', () => {
  const p = fresh();
  p.recordWin(1, 1, 100, 0);
  assert.ok(p.data.savedAt > 0);
});

test('merge: levels keep the best of the two copies, the rest comes from the newer copy', () => {
  const a = fresh();
  a.recordWin(1, 3, 5000, 0);
  a.recordWin(2, 1, 1000, 0);
  const older = copyOf(a);
  older.savedAt = 1000;
  const b = fresh();
  b.recordWin(2, 3, 900, 0);
  b.recordWin(3, 2, 700, 0);
  b.slot.coins = 77;
  const newer = copyOf(b);
  newer.savedAt = 2000;
  for (const merged of [mergeSaves(older, newer), mergeSaves(newer, older)]) {
    const slot = merged.slots.normal;
    assert.deepEqual(slot.levels[1], { stars: 3, best: 5000 });
    assert.deepEqual(slot.levels[2], { stars: 3, best: 1000 });
    assert.deepEqual(slot.levels[3], { stars: 2, best: 700 });
    assert.equal(slot.coins, 77);
    assert.equal(merged.savedAt, 2000);
  }
});

test('merge: a save file that only one copy has is kept', () => {
  const a = fresh();
  a.recordWin(1, 2, 100, 0);
  const b = fresh('easy');
  b.recordWin(1, 3, 100, 0);
  const merged = mergeSaves(copyOf(a), copyOf(b));
  assert.equal(merged.slots.normal.levels[1].stars, 2);
  assert.equal(merged.slots.easy.levels[1].stars, 3);
});

test('merge with no other copy changes nothing', () => {
  const a = copyOf(fresh());
  assert.equal(mergeSaves(a, null), a);
  assert.equal(mergeSaves(null, a), a);
});

test('adopt takes in the iCloud copy, keeps the save file in use, and says if anything changed', () => {
  const p = fresh();
  p.recordWin(1, 1, 100, 0);
  const cloud = copyOf(p);
  cloud.slots.normal.levels[2] = { stars: 3, best: 900 };
  cloud.active = 'easy';
  cloud.savedAt = p.data.savedAt - 5000;
  assert.equal(p.adopt(cloud), true);
  assert.equal(p.level(2).stars, 3);
  assert.equal(p.data.active, 'normal');
  assert.equal(p.adopt(copyOf(p)), false);
});

test('saving calls onSave with the data', () => {
  const p = fresh();
  let got = null;
  p.onSave = (data) => (got = data);
  p.recordWin(1, 1, 100, 0);
  assert.equal(got, p.data);
});
