import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Board } from '../src/engine/board.js';
import { LevelState, setupBoard } from '../src/engine/level.js';
import { runTurn } from '../src/engine/turn.js';
import { makeRng } from '../src/rng.js';

const board = (rows) => new Board({ rng: makeRng(11) }).load(rows);

test('a match next to a coconut cracks one layer', () => {
  const b = board(['rrrK', 'gbyo']);
  const step = b.resolveStep(null);
  assert.equal(b.block[0][3], 1);
  assert.equal(step.blocksHit.length, 1);
});

test('a coconut is hit once per step however many matches touch it', () => {
  const b = board(['rrrKggg', 'bybpyob']);
  b.resolveStep(null);
  assert.equal(b.block[0][3], 1);
});

test('blasts crack coconuts in their path', () => {
  const b = board(['yrRrogk', 'bgoypbo']);
  b.resolveStep(null);
  assert.equal(b.block[0][6], 0);
});

test('pieces never fall through a coconut', () => {
  const b = board(['g', 'k', '.']);
  b.applyGravity();
  assert.deepEqual(b.toStrings(), ['g', 'k', '.']);
});

test('a gap under a coconut fills by sliding diagonally', () => {
  const b = board(['gr', 'kb', '..']);
  const moves = b.applyGravity();
  // b drops straight down, r follows, then slides under the coconut.
  assert.deepEqual(b.toStrings(), ['g.', 'k.', 'rb']);
  const r = moves.find((m) => m.to[0] === 2 && m.to[1] === 0);
  assert.deepEqual(r.from, [0, 1]);
  // The top-right gap is fed from above.
  assert.equal(b.refill().length, 2);
});

test('refill skips cells a coconut cuts off', () => {
  const b = board(['k', '.']);
  assert.equal(b.refill().length, 0);
});

test('smash can crack a coconut', () => {
  const b = board(['Kr', 'gb']);
  const step = b.smashStep([0, 0]);
  assert.equal(b.block[0][0], 1);
  assert.equal(step.blocksHit.length, 1);
});

test('coconut and collect goals finish when met', () => {
  const layout = Array(9).fill('.........');
  layout[4] = '....k....';
  const lvl = { moves: 30, colors: 5, goal: { type: 'blockers' }, stars: [1, 2, 3], layout };
  const b = setupBoard(lvl, makeRng(2));
  const st = new LevelState(lvl, b);
  assert.equal(st.blockersLeft(), 1);
  b.block[4][4] = 0;
  assert.ok(st.isComplete());

  const lvl2 = { moves: 30, colors: 5, goal: { type: 'collect', targets: { r: 3 } }, stars: [1, 2, 3], layout: Array(9).fill('.........') };
  const b2 = setupBoard(lvl2, makeRng(3));
  const st2 = new LevelState(lvl2, b2);
  let guard = 0;
  while (!st2.isComplete() && guard++ < 30) runTurn(b2, st2, ...b2.findPossibleMove());
  assert.ok(st2.isComplete());
  assert.equal(st2.collectLeft().r, 0);
});

test('mochi cracks like a coconut', () => {
  const b = board(['rrrM', 'gbyo']);
  const step = b.resolveStep(null);
  assert.equal(b.block[0][3], 1);
  assert.equal(step.blocksHit[0].type, 'mochi');
});

test('a gummy cube falls, cannot be swapped, and pops beside a match', () => {
  const b = board(['u', '.']);
  b.applyGravity();
  assert.deepEqual(b.toStrings(), ['.', 'u']);
  const g = board(['ug', 'rb']);
  assert.equal(g.isValidSwap([0, 0], [0, 1]), false);
  const m = board(['urrr', 'gbyo']);
  const step = m.resolveStep(null);
  assert.ok(step.cleared.some((x) => x.special === 'gummy'));
  assert.equal(m.toStrings()[0], '....');
});

test('a dispenser drops its special every few refills', () => {
  const b = board(['..', 'gr']);
  b.dispensers = [{ col: 0, kind: 'bomb', every: 2, n: 0 }];
  b.refill();
  assert.notEqual(b.grid[0][0].special, 'bomb');
  b.grid[0][0] = null;
  const spawns = b.refill();
  assert.equal(b.grid[0][0].special, 'bomb');
  assert.ok(spawns.find((s) => s.to[1] === 0).dispensed);
});
