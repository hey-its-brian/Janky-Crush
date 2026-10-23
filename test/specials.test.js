import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Board, BOMB, STRIPE_H, STRIPE_V, WRAPPED, WRAPPED_LIT } from '../src/engine/board.js';
import { makeRng } from '../src/rng.js';

const board = (rows) => new Board({ rng: makeRng(5) }).load(rows);

// Swap like the player did, then resolve the first step.
function play(b, from, to) {
  assert.ok(b.isValidSwap(from, to), 'swap should be valid');
  b.swap(from, to);
  return b.isComboSwap(from, to) ? b.comboStep(from, to) : b.resolveStep({ from, to });
}

test('match 4 makes a striped candy where the player moved, stripes follow the swipe', () => {
  const b = board([
    'rrbr',
    'oyrg',
  ]);
  const step = play(b, [1, 2], [0, 2]); // vertical swipe
  assert.deepEqual(b.toStrings(), ['..R.', 'oybg']);
  assert.equal(b.grid[0][2].special, STRIPE_V);
  assert.equal(step.created.length, 1);
});

test('match 4 from a horizontal swipe makes a row-clearing stripe', () => {
  const b = board([
    'rrrbr',
    'oygyp',
  ]);
  play(b, [0, 4], [0, 3]);
  assert.equal(b.grid[0][3].special, STRIPE_H);
});

test('match 4 from a cascade makes stripes across the run', () => {
  const b = board(['rrrr', 'oygb']);
  b.resolveStep(null);
  const made = b.grid[0].find((x) => x?.special);
  assert.equal(made.special, STRIPE_V);
});

test('match 5 makes a color bomb', () => {
  const b = board([
    'rrbrr',
    'oyrgb',
  ]);
  play(b, [1, 2], [0, 2]);
  assert.deepEqual(b.toStrings(), ['..*..', 'oybgb']);
  assert.equal(b.grid[0][2].special, BOMB);
  assert.equal(b.grid[0][2].color, null);
});

test('an L shape makes a wrapped candy', () => {
  const b = board([
    'rrbr',
    'oyrg',
    'gorp',
  ]);
  play(b, [0, 3], [0, 2]);
  assert.deepEqual(b.toStrings(), ['..Rb', 'oy.g', 'go.p']);
  assert.equal(b.grid[0][2].special, WRAPPED);
});

test('a striped candy in a match clears its whole row', () => {
  const b = board([
    'yrRro',
    'bgoyp',
  ]);
  const step = b.resolveStep(null);
  assert.deepEqual(b.toStrings(), ['.....', 'bgoyp']);
  assert.ok(step.blasts.some((x) => x.kind === 'row' && x.index === 0));
});

test('a vertical striped candy clears its column', () => {
  const b = board([
    'byg',
    'rrr',
    'gpo',
  ]);
  b.grid[1][1].special = STRIPE_V;
  b.resolveStep(null);
  assert.deepEqual(b.toStrings(), ['b.g', '...', 'g.o']);
});

test('a wrapped candy explodes 3x3, stays lit, then explodes again', () => {
  const b = board([
    'bgoyp',
    'oyrpb',
    'grrrb',
    'pbgoy',
    'ybpgo',
  ]);
  b.grid[2][2].special = WRAPPED;
  const first = b.resolveStep(null);
  assert.equal(b.grid[2][2].special, WRAPPED_LIT);
  assert.deepEqual(b.toStrings(), [
    'bgoyp',
    'o...b',
    'g.R.b',
    'p...y',
    'ybpgo',
  ]);
  assert.deepEqual(first.lit, [[2, 2]]);

  const second = b.resolveStep(null);
  assert.ok(second);
  assert.equal(b.grid[2][2], null);
});

test('specials set each other off', () => {
  const b = board([
    'yrRro',
    'bgoyp',
    'gpbyo',
  ]);
  b.grid[0][4].special = STRIPE_V; // caught by the row blast, fires its column
  b.resolveStep(null);
  assert.deepEqual(b.toStrings(), ['.....', 'bgoy.', 'gpby.']);
});

test('bomb + candy clears every candy of that color', () => {
  const b = board([
    '*bg',
    'rgb',
    'brg',
  ]);
  play(b, [0, 0], [1, 0]);
  assert.deepEqual(b.toStrings(), ['.bg', '.gb', 'b.g']);
});

test('bomb + bomb clears the board', () => {
  const b = board([
    '**g',
    'rgb',
    'brg',
  ]);
  play(b, [0, 0], [0, 1]);
  assert.ok(b.toStrings().every((row) => /^\.+$/.test(row)));
});

test('bomb + striped turns that color striped and fires them all', () => {
  const b = board([
    '*Rgo',
    'gbyb',
    'ybry',
    'opgo',
  ]);
  const step = play(b, [0, 1], [0, 0]);
  assert.ok(step.converted.length >= 1);
  assert.equal(b.cellsOfColor('r').length, 0);
});

test('striped + striped clears a cross', () => {
  const b = board([
    'gobyp',
    'ybpgo',
    'pgRBy',
    'oyogb',
    'bpybg',
  ]);
  play(b, [2, 3], [2, 2]);
  const s = b.toStrings();
  assert.equal(s[2], '.....');
  assert.ok(s.every((row) => row[2] === '.'));
  assert.equal(s[0][0], 'g');
});

test('wrapped + wrapped clears 5x5', () => {
  const b = board([
    'gobypgo',
    'ybpgoyb',
    'pgobypg',
    'oyrgboy',
    'bpybgpb',
    'gobypgo',
    'ybpgoyb',
  ]);
  b.grid[3][2].special = WRAPPED;
  b.grid[3][3].special = WRAPPED;
  play(b, [3, 3], [3, 2]);
  const s = b.toStrings();
  for (let r = 1; r <= 5; r++) assert.equal(s[r].slice(0, 5), '.....');
  assert.equal(s[0], 'gobypgo');
  assert.equal(s[6], 'ybpgoyb');
});

test('striped + wrapped clears three rows and three columns', () => {
  const b = board([
    'gobypgo',
    'ybpgoyb',
    'pgobypg',
    'oyRgboy',
    'bpybgpb',
    'gobypgo',
    'ybpgoyb',
  ]);
  b.grid[3][3].special = WRAPPED;
  play(b, [3, 3], [3, 2]);
  const s = b.toStrings();
  for (const r of [2, 3, 4]) assert.equal(s[r], '.......');
  for (const c of [1, 2, 3]) assert.ok(s.every((row) => row[c] === '.'));
  assert.equal(s[0][6], 'o');
});

test('a bomb next to anything counts as a legal move', () => {
  const b = board([
    'rgb',
    'g*r',
    'brg',
  ]);
  assert.equal(b.findMatches().length, 0);
  assert.ok(b.findPossibleMove());
});

test('bombs and lit wrapped candies never match by color', () => {
  const b = board(['***']);
  assert.equal(b.findMatches().length, 0);
});

test('creating a special scores a bonus', () => {
  const b = board([
    'rrbr',
    'oyrg',
  ]);
  const step = play(b, [1, 2], [0, 2]);
  assert.equal(step.points, 120 + 60);
});
