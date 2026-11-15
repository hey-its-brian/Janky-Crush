import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Board } from '../src/engine/board.js';
import { LevelState, setupBoard, parseLayout } from '../src/engine/level.js';
import { runTurn, playSmash } from '../src/engine/turn.js';
import { makeRng } from '../src/rng.js';
import { LEVELS } from '../src/levels.js';

const row = (r, from, to) => Array.from({ length: Math.abs(to - from) + 1 }, (_, i) => [r, from + i * Math.sign(to - from)]);

test('a belt moves each piece one cell, and the last comes back in at the first', () => {
  const board = new Board({ rng: makeRng(1) }).load(['rgbo', 'ypyp']);
  board.belts = [row(0, 0, 3)];
  const moves = board.convey();
  assert.deepEqual(board.toStrings(), ['orgb', 'ypyp']);
  assert.equal(moves.length, 4);
  assert.deepEqual(moves.find((m) => m.wrap).to, [0, 0]);
  board.belts = [row(1, 3, 0)]; // the other way
  board.convey();
  assert.deepEqual(board.toStrings(), ['orgb', 'pypy']);
});

test('a ring belt turns, and no piece on it counts as leaving', () => {
  const board = new Board({ rng: makeRng(1) }).load(['rg', 'ob']);
  board.belts = [[[0, 0], [0, 1], [1, 1], [1, 0]]];
  const moves = board.convey();
  assert.deepEqual(board.toStrings(), ['or', 'bg']);
  assert.ok(moves.every((m) => !m.wrap));
});

test('a locked fruit takes its lock along the belt', () => {
  const board = new Board({ rng: makeRng(1) }).load(['rgbo', 'ypyp']);
  board.lock[0][1] = true;
  board.belts = [row(0, 0, 3)];
  board.convey();
  assert.equal(board.lock[0][1], false);
  assert.equal(board.lock[0][2], true);
  assert.equal(board.get(0, 2).color, 'g');
});

test('the belts move after a move of the player, and a match they make clears', () => {
  // The swap makes r r r in the bottom row. Then the belt in the top row
  // moves its y from column 2 to column 3, over two more y: a second match.
  const board = new Board({ rng: makeRng(5) }).load([
    'bgyob',
    'gboyg',
    'ybgyo',
    'ogbpo',
    'rryrg',
  ]);
  board.jelly[0][0] = 1;
  board.belts = [row(0, 0, 4)];
  const state = new LevelState({ moves: 10, goal: { type: 'jelly' }, stars: [1, 2, 3] }, board);
  const before = state.score;
  runTurn(board, state, [4, 2], [4, 3]);
  assert.ok(state.score - before > 60, 'two matches scored: the swap and the belt');
});

test('a booster does not move the belts', () => {
  const board = new Board({ rng: makeRng(1) }).load(['rgbo', 'ypyp', 'bobr']);
  board.jelly[2][0] = 1;
  board.belts = [row(2, 0, 3)];
  const state = new LevelState({ moves: 10, goal: { type: 'jelly' }, stars: [1, 2, 3] }, board);
  let turns = 0;
  const convey = board.convey.bind(board);
  board.convey = () => (turns++, convey());
  for (const _ of playSmash(board, state, [0, 3]));
  assert.equal(turns, 0);
});

test('jam does not grow onto a belt', () => {
  const board = new Board({ rng: makeRng(1) }).load(['rjb', 'gyo']);
  board.belts = [[[0, 0], [1, 0]], [[0, 2], [1, 2]]];
  for (let i = 0; i < 10; i++) {
    const copy = board.clone();
    assert.deepEqual(copy.spreadJam().to, [1, 1]);
  }
});

test('every belt cell in the levels is an open cell with no blocker, and is on one belt only', () => {
  for (const lvl of LEVELS.filter((l) => l.belts)) {
    const { mask, block } = parseLayout(lvl.layout);
    const seen = new Set();
    for (const path of lvl.belts) {
      for (const [r, c] of path) {
        assert.ok(mask[r][c] && !block[r][c], `level ${lvl.id}: belt cell ${r},${c}`);
        assert.ok(!seen.has(`${r},${c}`), `level ${lvl.id}: cell ${r},${c} is on two belts`);
        seen.add(`${r},${c}`);
      }
      // Each step is to a neighbor cell.
      for (let i = 1; i < path.length; i++)
        assert.equal(Math.abs(path[i][0] - path[i - 1][0]) + Math.abs(path[i][1] - path[i - 1][1]), 1, `level ${lvl.id}`);
    }
  }
});

test('the conveyor levels play through', () => {
  for (const lvl of LEVELS.filter((l) => l.belts)) {
    const board = setupBoard(lvl, makeRng(3));
    const state = new LevelState(lvl, board);
    for (let i = 0; i < 60 && !state.isOver(); i++) runTurn(board, state, ...board.findPossibleMove());
    assert.ok(state.isOver(), `level ${lvl.id} ends`);
  }
});
