import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Board, scoreFor, uniqueCells } from '../src/engine/board.js';
import { makeRng } from '../src/rng.js';

const board = (rows, seed = 1) => new Board({ rng: makeRng(seed) }).load(rows);

test('initial fill has no matches and a legal move', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const b = new Board({ rng: makeRng(seed) });
    b.fillInitial();
    assert.equal(b.findMatches().length, 0, `seed ${seed}`);
    assert.ok(b.findPossibleMove(), `seed ${seed}`);
  }
});

test('initial fill respects the mask', () => {
  const mask = Array.from({ length: 9 }, (_, r) =>
    Array.from({ length: 9 }, (_, c) => !((r === 0 || r === 8) && (c === 0 || c === 8)))
  );
  const b = new Board({ mask, rng: makeRng(7) });
  b.fillInitial();
  assert.equal(b.grid[0][0], null);
  assert.equal(b.grid[8][8], null);
  assert.ok(b.grid[4][4]);
});

test('finds horizontal and vertical runs', () => {
  const b = board([
    'rrrgb',
    'gbyoy',
    'gyboy',
    'gopby',
  ]);
  const groups = b.findMatches();
  const dirs = groups.map((g) => `${g.dir}${g.cells.length}`).sort();
  assert.deepEqual(dirs, ['h3', 'v3', 'v3']);
});

test('runs stop at holes', () => {
  const b = board(['rr r']);
  assert.equal(b.findMatches().length, 0);
});

test('trySwap keeps a matching swap and reverts a dud', () => {
  const b = board([
    'rgrr',
    'bobo',
  ]);
  assert.equal(b.trySwap([0, 0], [0, 1]), true);
  assert.deepEqual(b.toStrings(), ['grrr', 'bobo']);

  const c = board([
    'rgby',
    'oprg',
  ]);
  assert.equal(c.trySwap([0, 0], [0, 1]), false);
  assert.deepEqual(c.toStrings(), ['rgby', 'oprg']);
});

test('trySwap rejects non-adjacent cells', () => {
  const b = board(['rgrr']);
  assert.equal(b.trySwap([0, 0], [0, 2]), false);
});

test('gravity drops candies and skips holes', () => {
  const b = board([
    'r g',
    '. .',
    'b .',
    '. y',
  ]);
  const moves = b.applyGravity();
  assert.deepEqual(b.toStrings(), [
    '. .',
    '. .',
    'r g',
    'b y',
  ]);
  assert.equal(moves.length, 3);
});

test('refill fills every empty playable cell and stacks spawns above', () => {
  const b = board([
    '. .',
    '. r',
    'g y',
  ]);
  const spawns = b.refill();
  assert.ok(b.toStrings().every((row) => !row.includes('.')));
  const col0 = spawns.filter((s) => s.to[1] === 0).map((s) => s.fromRow);
  assert.deepEqual(col0, [-2, -1]);
});

test('clear then gravity then refill leaves a full board', () => {
  const b = new Board({ rng: makeRng(3) });
  b.fillInitial();
  const [a, c] = b.findPossibleMove();
  assert.ok(b.trySwap(a, c));
  const cells = uniqueCells(b.findMatches());
  b.clear(cells);
  b.applyGravity();
  b.refill();
  assert.ok(b.toStrings().every((row) => !row.includes('.')));
});

test('shuffle keeps the same candies and leaves a playable board', () => {
  const b = new Board({ rng: makeRng(11) });
  b.fillInitial();
  const before = b.grid.flat().map((x) => x.id).sort((x, y) => x - y);
  b.shuffle();
  const after = b.grid.flat().map((x) => x.id).sort((x, y) => x - y);
  assert.deepEqual(after, before);
  assert.equal(b.findMatches().length, 0);
  assert.ok(b.findPossibleMove());
});

test('scoring grows with run size and cascade', () => {
  const g = (n) => ({ cells: Array(n).fill([0, 0]) });
  assert.equal(scoreFor([g(3)], 1), 60);
  assert.equal(scoreFor([g(4)], 1), 120);
  assert.equal(scoreFor([g(5)], 1), 200);
  assert.equal(scoreFor([g(3), g(3)], 2), 240);
});
