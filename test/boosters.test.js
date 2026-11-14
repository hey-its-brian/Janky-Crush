import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Board } from '../src/engine/board.js';
import { LevelState, setupBoard } from '../src/engine/level.js';
import { playSmash, playSwitch, playSweep, playPick } from '../src/engine/turn.js';
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

test('sweep clears the row and the column of a cell', () => {
  const b = board(['rgbo', 'oypr', 'bgry']);
  const step = b.sweepStep([1, 1]);
  assert.deepEqual(b.toStrings(), ['r.bo', '....', 'b.ry']);
  assert.equal(step.cleared.length, 6);
});

test('sweep works on a blocker cell and hits each blocker on its lines', () => {
  const b = board(['rKbo', 'ojpr', 'bgry']);
  b.sweepStep([1, 1]);
  assert.deepEqual(b.toStrings(), ['rkbo', '....', 'b.ry']);
});

test('picker takes every fruit of one kind and opens locks of that kind', () => {
  const b = board(['rgbo', 'oyrr', 'bgry']);
  b.lock[2][2] = true;
  const step = b.pickStep([0, 0]);
  assert.deepEqual(b.toStrings(), ['.gbo', 'oy..', 'bgry']);
  assert.equal(b.lock[2][2], false);
  assert.equal(step.unlocked.length, 1);
});

test('picker needs a fruit: no color bomb, ingredient, blocker or empty cell', () => {
  const b = board(['*@k.', 'oypr']);
  for (let c = 0; c < 4; c++) assert.equal(b.pickStep([0, c]), null);
});

test('sweep and picker do not use up moves or tick the timers', () => {
  const b = board(['rgbo', 'oypr', 'bgry', 'yobg']);
  b.jelly[3][3] = 1;
  b.grid[3][3].timer = 1;
  const state = new LevelState({ moves: 10, goal: { type: 'jelly' }, stars: [1, 2, 3] }, b);
  for (const _ of playSweep(b, state, [0, 0]));
  for (const _ of playPick(b, state, [1, 1]));
  assert.equal(state.moves, 10);
  assert.equal(state.exploded, null);
});
