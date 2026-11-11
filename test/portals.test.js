import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Board } from '../src/engine/board.js';
import { setupBoard, LevelState } from '../src/engine/level.js';
import { runTurn } from '../src/engine/turn.js';
import { makeRng } from '../src/rng.js';

// Two columns. The left one is cut after row 1: a piece that falls out of
// (1, 0) comes in at (0, 1), the top of the right column.
const twoColumns = (rows) => {
  const b = new Board({ rng: makeRng(1) }).load(rows);
  b.portals = [{ from: [1, 0], to: [0, 1] }];
  return b;
};

test('a piece falls out of a portal entrance and in at the exit', () => {
  const b = twoColumns(['r.', 'g.', ' .']);
  const falls = b.applyGravity();
  // The right column fills from the bottom: g first, then r.
  assert.deepEqual(b.toStrings(), ['..', '.r', ' g']);
  const g = falls.find((f) => f.to[0] === 2 && f.to[1] === 1);
  assert.deepEqual(g.from, [1, 0]);
  assert.equal(g.via.length, 1);
  assert.deepEqual(g.via[0].to, [0, 1]);
});

test('a move inside one column has no portal on it', () => {
  const b = twoColumns(['r.', '..', ' g']);
  const falls = b.applyGravity();
  assert.deepEqual(b.toStrings(), ['..', '.r', ' g']);
  assert.equal(falls.length, 1);
  assert.equal(falls[0].via.length, 1);
  const c = twoColumns(['..', 'r.', ' .']);
  c.grid[0][1] = c.newCandy('b');
  const moves = c.applyGravity();
  const b2 = moves.find((m) => m.from[1] === 1);  // the b drops inside the right column
  assert.equal(b2.via, undefined);
});

test('cells after a portal are fed from the entrance column', () => {
  const b = twoColumns(['..', '..', ' .']);
  assert.equal(b.fed(2, 1), true);
  assert.equal(b.fed(0, 0), true);
  const spawns = b.refill();
  assert.equal(spawns.length, 5);
  assert.equal(b.hasGaps(), false);
  const far = spawns.find((s) => s.to[0] === 2 && s.to[1] === 1);
  assert.equal(far.col, 0);                       // it drops into the left column
  assert.equal(far.via.length, 1);
  const near = spawns.find((s) => s.to[0] === 0 && s.to[1] === 0);
  assert.equal(near.via, undefined);
});

test('a coconut on the path stops the feed through a portal', () => {
  const b = twoColumns(['..', 'k.', ' .']);
  assert.equal(b.fed(0, 0), true);
  assert.equal(b.fed(0, 1), false);
});

test('the part of a column above an exit keeps its own pieces', () => {
  // Column 1: row 0 is above the exit at row 1, so it is a separate path.
  const b = new Board({ rng: makeRng(1) }).load(['rg', 'b.', ' .']);
  b.portals = [{ from: [1, 0], to: [1, 1] }];
  b.applyGravity();
  assert.equal(b.get(0, 1).color, 'g');           // stays above the exit
  assert.equal(b.get(2, 1).color, 'b');           // came through the portal
  assert.equal(b.get(1, 1).color, 'r');
});

test('ingredient exits are at the end of each path, not at a portal entrance', () => {
  const b = twoColumns(['..', '..', ' .']);
  b.setExits();
  assert.equal(b.isExit(1, 0), false);
  assert.equal(b.isExit(2, 1), true);
});

test('with no portals every column is one path, as before', () => {
  const b = new Board({ rng: makeRng(1) }).load(['r.', '  ', '.g']);
  b.applyGravity();
  assert.deepEqual(b.toStrings(), ['..', '  ', 'rg']);
});

test('portal levels play through without getting stuck', () => {
  const level = {
    id: 99, goal: { type: 'score' }, moves: 30, colors: 5,
    layout: [...Array(4).fill('.........'), '         ', ...Array(4).fill('.........')],
    // Each column of the top half drops into the next column of the bottom half.
    portals: Array.from({ length: 9 }, (_, c) => [3, c, 5, (c + 1) % 9]),
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
