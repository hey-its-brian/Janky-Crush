import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Board, INGREDIENT, STRIPE_H, WRAPPED } from '../src/engine/board.js';
import { setupBoard, LevelState, parseLayout } from '../src/engine/level.js';
import { playTurn, runTurn, runBonus } from '../src/engine/turn.js';
import { makeRng } from '../src/rng.js';

const board = (rows) => new Board({ rng: makeRng(9) }).load(rows);

test('matching on jelly takes off one layer', () => {
  const b = board(['rrrg', 'bgyo']);
  b.jelly[0][0] = 1;
  b.jelly[0][1] = 2;
  b.jelly[1][0] = 1; // not matched
  const step = b.resolveStep(null);
  assert.deepEqual(b.jelly[0].slice(0, 3), [0, 1, 0]);
  assert.equal(b.jelly[1][0], 1);
  assert.equal(step.jellyHit.length, 2);
  assert.equal(b.jellyCount(), 2);
});

test('blasts clear jelly too', () => {
  const b = board(['yrRro', 'bgoyp']);
  b.jelly[0][4] = 1; // only reached by the stripe
  b.resolveStep(null);
  assert.equal(b.jelly[0][4], 0);
});

test('jelly under a newly made special is cleared', () => {
  const b = board(['rrbr', 'oyrg']);
  b.jelly[0][2] = 1;
  b.swap([1, 2], [0, 2]);
  b.resolveStep({ from: [1, 2], to: [0, 2] });
  assert.equal(b.jelly[0][2], 0);
});

test('ingredients cannot be matched or blasted', () => {
  // The striped red's row blast passes over the ingredient.
  const b = board(['rRr@o', 'bgoyp']);
  b.resolveStep(null);
  assert.equal(b.grid[0][3].special, INGREDIENT);
  assert.equal(b.matchColor(0, 3), null);
});

test('an ingredient only swaps if the other candy makes a match', () => {
  const b = board([
    'g@gg',
    'pbor',
  ]);
  assert.equal(b.isValidSwap([0, 0], [0, 1]), true); // g slides into the run
  const c = board(['@b', 'gy']);
  assert.equal(c.isValidSwap([0, 0], [0, 1]), false);
  assert.equal(c.isComboSwap([0, 0], [0, 1]), false);
});

test('ingredients fall to the exit and are collected', () => {
  const b = board([
    '@go',
    'ryb',
    '.og',
  ]);
  b.setExits();
  assert.equal(b.collectIngredients().length, 0); // still at the top
  b.applyGravity();
  b.refill();
  assert.equal(b.grid[1][0].special, INGREDIENT); // dropped one row
  b.grid[2][0] = null; // clear the cell below it
  b.applyGravity();
  const got = b.collectIngredients();
  assert.equal(got.length, 1);
  assert.equal(b.grid[2][0], null);
});

test('shuffle leaves ingredients in place', () => {
  const b = new Board({ rng: makeRng(4) });
  b.fillInitial();
  b.grid[0][3] = b.newIngredient('pup');
  b.shuffle();
  assert.equal(b.grid[0][3].special, INGREDIENT);
});

test('layout parsing', () => {
  const { mask, jelly } = parseLayout([' .1', '2. ']);
  assert.deepEqual(mask, [[false, true, true], [true, true, false]]);
  assert.deepEqual(jelly, [[0, 0, 1], [2, 0, 0]]);
});

const full = Array(9).fill('.........');

test('a jelly level is complete when the last jelly goes', () => {
  const level = { goal: { type: 'jelly' }, moves: 10, colors: 5, stars: [100, 200, 300], layout: full };
  const b = setupBoard(level, makeRng(1));
  const s = new LevelState(level, b);
  assert.equal(s.isComplete(), true); // no jelly at all
  b.jelly[4][4] = 1;
  assert.equal(s.isComplete(), false);
  assert.equal(s.jellyLeft(), 1);
});

test('ingredient levels start with ingredients on top and exits at the bottom', () => {
  const level = { goal: { type: 'ingredients', count: 5 }, moves: 20, colors: 5, stars: [1, 2, 3], layout: full };
  const b = setupBoard(level, makeRng(2));
  assert.equal(b.countIngredients(), 3); // up to 3 on the board at once
  assert.ok(b.grid[0].some((x) => x.special === INGREDIENT));
  assert.equal(b.exits.size, 9);
  assert.equal(b.spawner.remaining, 2);
});

test('score levels are won on points when moves run out', () => {
  const level = { goal: { type: 'score' }, moves: 1, colors: 5, stars: [50, 5000, 9000], layout: full };
  const b = setupBoard(level, makeRng(3));
  const s = new LevelState(level, b);
  const [a, c] = b.findPossibleMove();
  runTurn(b, s, a, c);
  assert.equal(s.moves, 0);
  assert.equal(s.isOver(), true);
  assert.equal(s.won(), s.score >= 50);
  assert.equal(s.stars(), s.score >= 5000 ? 2 : 1);
});

test('a turn yields steps and falls, and leaves a full board', () => {
  const level = { goal: { type: 'score' }, moves: 5, colors: 6, stars: [1, 2, 3], layout: full };
  const b = setupBoard(level, makeRng(5));
  const s = new LevelState(level, b);
  const kinds = [];
  for (const ev of playTurn(b, s, ...b.findPossibleMove())) kinds.push(ev.type);
  assert.equal(kinds[0], 'step');
  assert.ok(kinds.includes('fall'));
  assert.ok(b.toStrings().every((row) => !row.includes('.')));
  assert.ok(s.score > 0);
});

test('the bonus round turns leftover moves into stripes and fires them', () => {
  const level = { goal: { type: 'score' }, moves: 5, colors: 6, stars: [1, 2, 3], layout: full };
  const b = setupBoard(level, makeRng(6));
  b.grid[4][4].special = WRAPPED;
  const s = new LevelState(level, b);
  runBonus(b, s);
  assert.equal(s.moves, 0);
  assert.ok(s.score > 0);
  // Nothing special is left on the board afterwards.
  const left = b.grid.flat().filter((x) => x?.special && x.special !== INGREDIENT);
  assert.equal(left.length, 0);
});

test('a full ingredient level can be played to the end by always taking the first move', () => {
  const level = { goal: { type: 'ingredients', count: 2 }, moves: 60, colors: 4, stars: [1, 2, 3], layout: full };
  const b = setupBoard(level, makeRng(8));
  const s = new LevelState(level, b);
  while (!s.isOver()) runTurn(b, s, ...b.findPossibleMove());
  assert.ok(s.collected >= 0 && s.collected <= 2);
  assert.ok(b.grid.flat().every((x) => x));
});

test('stripes from the bonus fire along their stripes', () => {
  const b = board(['rgby', 'gbyr', 'byrg', 'yrgb']);
  const step = b.primeBonus(2);
  assert.equal(step.converted.length, 2);
  for (const c of step.converted) assert.ok(c.special === STRIPE_H || c.special === 'stripeV');
  const fire = b.firePrimed();
  assert.ok(fire.blasts.length >= 2);
});
