import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Board } from '../src/engine/board.js';
import { LevelState, setupBoard } from '../src/engine/level.js';
import { playSmash, playSwitch } from '../src/engine/turn.js';
import { makeRng } from '../src/rng.js';

const board = (rows) => new Board({ rng: makeRng(3) }).load(rows);

test('smash clears one plain piece', () => {
  const b = board(['rgb', 'oyp']);
  const step = b.smashStep([0, 1]);
  assert.deepEqual(b.toStrings(), ['r.b', 'oyp']);
  assert.equal(step.cleared.length, 1);
});

test('smashing a striped piece sets it off', () => {
  const b = board(['rGbo', 'oypr']);
  b.smashStep([0, 1]);
  assert.deepEqual(b.toStrings(), ['....', 'oypr']);
});

test('ingredients and empty cells cannot be smashed', () => {
  const b = board(['@.r', 'oyp']);
  assert.equal(b.smashStep([0, 0]), null);
  assert.equal(b.smashStep([0, 1]), null);
});

test('boosters do not use up moves', () => {
  const level = { moves: 10, colors: 5, goal: { type: 'score' }, stars: [100, 200, 300], layout: Array(9).fill('.........') };
  const b = setupBoard(level, makeRng(4));
  const state = new LevelState(level, b);
  for (const _ of playSmash(b, state, [4, 4]));
  assert.equal(state.moves, 10);
  assert.ok(state.score > 0);
  const [a, c] = [[0, 0], [0, 1]];
  for (const _ of playSwitch(b, state, a, c));
  assert.equal(state.moves, 10);
});

test('switch swaps two pieces even when nothing matches', () => {
  const b = board(['rgbyo', 'oypyp', 'ppbgy']);
  const state = { moves: 5, score: 0, noteStep() {} };
  for (const _ of playSwitch(b, state, [0, 0], [0, 1]));
  assert.equal(b.toStrings()[0], 'grbyo');
});
