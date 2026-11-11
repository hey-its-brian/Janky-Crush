import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Board } from '../src/engine/board.js';
import { setupBoard, LevelState } from '../src/engine/level.js';
import { runTurn } from '../src/engine/turn.js';
import { makeRng } from '../src/rng.js';

const board = (rows, locks = []) => {
  const b = new Board({ rng: makeRng(1) }).load(rows);
  for (const [r, c] of locks) b.lock[r][c] = true;
  return b;
};

test('a locked piece cannot be swapped', () => {
  const b = board(['rrgr', 'gbyb', 'bygy'], [[0, 2]]);
  assert.equal(b.isValidSwap([0, 2], [0, 3]), false);
  b.lock[0][2] = false;
  assert.equal(b.isValidSwap([0, 2], [0, 3]), true);
});

test('the Switch booster cannot move a locked piece', () => {
  const b = board(['rg', 'by'], [[0, 0]]);
  assert.equal(b.canSwitch([0, 0], [0, 1]), false);
  assert.equal(b.canSwitch([1, 0], [1, 1]), true);
});

test('a match with a locked piece opens the lock and leaves the piece', () => {
  const b = board(['rrgr', 'gbyb', 'bygy'], [[0, 0]]);
  assert.ok(b.trySwap([0, 2], [0, 3]));
  const step = b.resolveStep({ from: [0, 2], to: [0, 3] });
  assert.deepEqual(step.unlocked.map((u) => u.at), [[0, 0]]);
  assert.equal(b.lock[0][0], false);
  assert.equal(b.get(0, 0).color, 'r');           // still there
  assert.equal(b.get(0, 1), null);                // the others cleared
  assert.equal(b.get(0, 2), null);
});

test('a blast opens a lock and does not clear the piece', () => {
  const b = board(['Rgbg', 'ybyb'], [[0, 2]]);
  const step = b.smashStep([0, 0]);               // sets off the striped piece
  assert.deepEqual(step.unlocked.map((u) => u.at), [[0, 2]]);
  assert.equal(b.get(0, 2).color, 'b');
  assert.equal(b.get(0, 1), null);
  assert.equal(b.get(0, 3), null);
});

test('the Smash booster opens a lock', () => {
  const b = board(['rg', 'by'], [[0, 0]]);
  const step = b.smashStep([0, 0]);
  assert.equal(step.unlocked.length, 1);
  assert.equal(b.lock[0][0], false);
  assert.equal(b.get(0, 0).color, 'r');
});

test('a locked piece does not fall, and pieces above it stay above', () => {
  const b = board(['g', 'r', '.', '.'], [[1, 0]]);
  b.applyGravity();
  assert.deepEqual(b.toStrings(), ['g', 'r', '.', '.']);
  b.lock[1][0] = false;
  b.applyGravity();
  assert.deepEqual(b.toStrings(), ['.', '.', 'g', 'r']);
});

test('a gap under a locked piece is filled from the side', () => {
  const b = board(['gb', 'ry', '.o'], [[1, 0]]);
  const falls = b.applyGravity();
  assert.equal(b.get(2, 0).color, 'y');           // slid in from the next column
  assert.equal(falls.length >= 1, true);
  assert.equal(b.fed(2, 0), false);
});

test('a shuffle leaves locked pieces where they are', () => {
  const b = board(['rgbyr', 'gbyrg', 'byrgb', 'yrgby'], [[1, 1], [2, 3]]);
  const ids = [b.get(1, 1).id, b.get(2, 3).id];
  b.shuffle();
  assert.deepEqual([b.get(1, 1).id, b.get(2, 3).id], ids);
});

test("a level layout places locked fruit with 'L' and 'l'", () => {
  const level = {
    id: 99, goal: { type: 'score' }, moves: 10, colors: 5,
    layout: ['.........', '....L....', '...l.l...', ...Array(6).fill('.........')],
  };
  const b = setupBoard(level, makeRng(5));
  assert.equal(b.lock[1][4], true);
  assert.equal(b.lock[2][3], true);
  assert.equal(b.jelly[2][3], 1);
  assert.equal(b.jelly[1][4], 0);
  assert.ok(b.get(1, 4).color);
  assert.ok(b.findPossibleMove());
});

test('locked levels play through without getting stuck', () => {
  const level = {
    id: 99, goal: { type: 'score' }, moves: 30, colors: 5,
    layout: ['.........', '.L.L.L.L.', '.........', 'L.L.L.L.L', '.........', '.L.L.L.L.', '.........', '.........', '.........'],
  };
  for (const seed of [1, 2, 3, 4]) {
    const b = setupBoard(level, makeRng(seed));
    const state = new LevelState(level, b);
    for (let t = 0; t < 30; t++) {
      const move = b.findPossibleMove();
      assert.ok(move, 'there is always a move');
      runTurn(b, state, ...move);
      assert.equal(b.hasGaps(), false, 'the board is full after every turn');
    }
  }
});
