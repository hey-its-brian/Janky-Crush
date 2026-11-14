import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Board } from '../src/engine/board.js';
import { LevelState, setupBoard } from '../src/engine/level.js';
import { runTurn, runBonus, playSmash } from '../src/engine/turn.js';
import { makeRng } from '../src/rng.js';

const level = (extra = {}) => ({ goal: { type: 'jelly' }, moves: 20, stars: [100, 200, 300], ...extra });
const BOARD = [
  'bgyob',
  'gbogy',
  'ybgbo',
  'ogbyo',
  'rryrg',
];
const timers = (board) => board.grid.flat().filter((c) => c?.timer != null).map((c) => c.timer);

function start(extra) {
  const board = new Board({ rng: makeRng(7) }).load(BOARD);
  board.jelly[0][0] = 1; // a goal that the test moves do not complete
  return { board, state: new LevelState(level(extra), board) };
}

test('each move takes one off every timer', () => {
  const { board, state } = start();
  board.grid[0][4].timer = 5;
  runTurn(board, state, [4, 2], [4, 3]);
  assert.deepEqual(timers(board), [4]);
  assert.ok(!state.isOver());
});

test('a timer that gets to zero loses the level', () => {
  const { board, state } = start();
  board.grid[0][4].timer = 1;
  runTurn(board, state, [4, 2], [4, 3]);
  assert.deepEqual(state.exploded, [0, 4]);
  assert.ok(state.isOver());
  assert.ok(!state.won());
  assert.equal(state.stars(), 0);
});

test('a matched timer fruit is safe, and is counted', () => {
  const { board, state } = start();
  board.grid[4][0].timer = 1;
  runTurn(board, state, [4, 2], [4, 3]);
  assert.equal(state.exploded, null);
  assert.deepEqual(timers(board), []);
  assert.equal(state.stats.defused, 1);
});

test('a booster does not count as a move', () => {
  const { board, state } = start();
  board.grid[0][4].timer = 1;
  for (const _ of playSmash(board, state, [4, 4]));
  assert.deepEqual(timers(board), [1]);
  assert.equal(state.exploded, null);
});

test('the move that wins the level stops the timers', () => {
  const { board, state } = start();
  board.jelly[0][0] = 0;
  board.jelly[4][0] = 1;
  board.grid[0][4].timer = 1;
  runTurn(board, state, [4, 2], [4, 3]);
  assert.ok(state.isComplete());
  assert.equal(state.exploded, null);
  runBonus(board, state);
  assert.deepEqual(timers(board), []);
});

test('a timer fruit that becomes a special is safe', () => {
  const board = new Board({ rng: makeRng(8) }).load([
    'rrgrb',
    'bgrog',
    'gbyby',
  ]);
  board.jelly[2][4] = 1;
  const state = new LevelState(level(), board);
  board.grid[1][2].timer = 1; // the fruit the player moves into a row of four
  runTurn(board, state, [1, 2], [0, 2]);
  assert.equal(state.exploded, null);
  assert.deepEqual(timers(board), []);
  assert.equal(state.stats.striped, 1);
});

test('a level starts with its timers and brings in more', () => {
  const lvl = level({ colors: 5, layout: Array(9).fill('.........'), timers: { start: 2, fuse: 9, every: 2, max: 3 }, goal: { type: 'score' }, moves: 40 });
  const board = setupBoard(lvl, makeRng(11));
  const state = new LevelState({ ...lvl, stars: [1e9, 2e9, 3e9] }, board);
  assert.deepEqual(timers(board), [9, 9]);
  let most = 0, fresh = false;
  for (let i = 0; i < 12 && !state.isOver(); i++) {
    runTurn(board, state, ...board.findPossibleMove());
    most = Math.max(most, board.timerCount());
    if (timers(board).includes(9)) fresh = true; // a new one does not count down in the move it drops in
  }
  assert.ok(most <= 3);
  assert.ok(fresh);
});
