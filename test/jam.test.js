import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Board } from '../src/engine/board.js';
import { LevelState } from '../src/engine/level.js';
import { runTurn, playSmash } from '../src/engine/turn.js';
import { makeRng } from '../src/rng.js';

const level = (goal = { type: 'blockers' }) => ({ goal, moves: 20, stars: [100, 200, 300] });
const count = (board, ch) => board.toStrings().join('').split(ch).length - 1;

test('a match beside jam clears it, and jam does not grow in that move', () => {
  const board = new Board({ rng: makeRng(1) }).load([
    'rryb',
    'jgro',
    'ybgo',
    'gyby',
  ]);
  const state = new LevelState(level(), board);
  runTurn(board, state, [0, 2], [1, 2]); // makes r r r along the top row
  assert.equal(board.jamCount(), 0);
  assert.ok(state.isComplete());
});

test('jam grows by one cell after a move that clears none of it', () => {
  // The match is in the top row. The jam is in the bottom corner, where
  // no new fruit can fall next to it.
  const board = new Board({ rng: makeRng(2) }).load([
    'rryrg',
    'ogbyo',
    'ybgbo',
    'gbogy',
    'bgyoj',
  ]);
  const state = new LevelState(level(), board);
  runTurn(board, state, [0, 2], [0, 3]);
  assert.equal(board.jamCount(), 2);
  assert.equal(count(board, 'j'), 2);
  assert.ok(!state.isOver());
});

test('jam does not grow after a booster', () => {
  const board = new Board({ rng: makeRng(3) }).load([
    'jgyob',
    'gbogy',
    'ybgbo',
    'ogbyo',
    'rgyrg',
  ]);
  const state = new LevelState(level(), board);
  for (const _ of playSmash(board, state, [4, 4]));
  assert.equal(board.jamCount(), 1);
});

test('jam never covers a locked fruit, a timer fruit, an ingredient or a gummy', () => {
  const board = new Board({ rng: makeRng(4) }).load([
    'bju',
    'g@y',
    'ybg',
  ]);
  board.lock[0][0] = true;
  assert.equal(board.spreadJam(), null);
  board.lock[0][0] = false;
  board.grid[0][0].timer = 5;
  assert.equal(board.spreadJam(), null);
  delete board.grid[0][0].timer;
  const grown = board.spreadJam();
  assert.deepEqual(grown.to, [0, 0]);
  assert.equal(grown.eaten.color, 'b');
  assert.equal(board.get(0, 0), null);
});

test('jam takes a plain fruit before a special', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const board = new Board({ rng: makeRng(seed) }).load([
      'Rjb',
    ]);
    assert.deepEqual(board.spreadJam().to, [0, 2]);
  }
});

test('pieces do not fall through jam', () => {
  const board = new Board({ rng: makeRng(5) }).load([
    'r',
    'j',
    '.',
  ]);
  board.applyGravity();
  assert.deepEqual(board.toStrings(), ['r', 'j', '.']);
});
