import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Progress, MAX_LIVES, LIFE_REFILL_MS, PRICES, START_COINS, DAILY_COINS } from '../src/save.js';

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
  assert.deepEqual(first, { win: 5, stars: 20, moves: 3, total: 28 });
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
