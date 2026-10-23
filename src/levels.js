// Levels 1–30. Each level's layout, goal and number of candy colors is
// designed here; its moves (for jelly and ingredient levels) and star
// scores come from level-tuning.js, which tools/tune.mjs writes by having a
// computer player play every level many times.
//
// Layout: 9 strings of 9. ' ' not on the board, '.' plain, '1' jelly,
// '2' double jelly. See src/engine/level.js.

import { TUNING } from './level-tuning.js';

const fill = (ch, n = 9) => Array(n).fill(ch.repeat(9));

const CORNERS = [' ....... ', ...fill('.', 7), ' ....... '];
const DIAMOND = [
  '  .....  ',
  ' ....... ',
  ...fill('.', 5),
  ' ....... ',
  '  .....  ',
];
const HOURGLASS = [
  '.........',
  ' ....... ',
  '  .....  ',
  '   ...   ',
  '   ...   ',
  '   ...   ',
  '  .....  ',
  ' ....... ',
  '.........',
];
const NARROW = Array(9).fill(' ....... ');
const FULL = fill('.');

export const LEVEL_DESIGNS = [
  // 1–5: learn the basics
  { id: 1, goal: { type: 'score' }, moves: 20, colors: 5, layout: CORNERS },
  { id: 2, goal: { type: 'score' }, moves: 20, colors: 5, layout: DIAMOND },
  {
    id: 3, goal: { type: 'jelly' }, colors: 5,
    layout: [
      ' ....... ',
      '.........',
      '.........',
      '...111...',
      '...111...',
      '...111...',
      '.........',
      '.........',
      ' ....... ',
    ],
  },
  { id: 4, goal: { type: 'score' }, moves: 22, colors: 6, layout: FULL },
  {
    id: 5, goal: { type: 'jelly' }, colors: 5,
    layout: [
      '.........',
      '.........',
      '.........',
      '.........',
      '111111111',
      '.........',
      '.........',
      '.........',
      '.........',
    ],
  },

  // 6–10: ingredients arrive
  { id: 6, goal: { type: 'ingredients', count: 2 }, colors: 5, layout: NARROW },
  {
    id: 7, goal: { type: 'jelly' }, colors: 5,
    layout: [
      '1.......1',
      '.1.....1.',
      '..1...1..',
      '...1.1...',
      '....1....',
      '...1.1...',
      '..1...1..',
      '.1.....1.',
      '1.......1',
    ],
  },
  { id: 8, goal: { type: 'score' }, moves: 22, colors: 6, layout: HOURGLASS },
  { id: 9, goal: { type: 'ingredients', count: 3 }, colors: 5, layout: FULL },
  {
    id: 10, goal: { type: 'jelly' }, colors: 5,
    layout: [...fill('.', 4), ...fill('1', 5)],
  },

  // 11–15: double jelly
  {
    id: 11, goal: { type: 'jelly' }, colors: 5,
    layout: [
      '.........',
      '.........',
      '..11111..',
      '..12221..',
      '..12221..',
      '..12221..',
      '..11111..',
      '.........',
      '.........',
    ],
  },
  { id: 12, goal: { type: 'ingredients', count: 3 }, colors: 5, layout: NARROW },
  { id: 13, goal: { type: 'score' }, moves: 25, colors: 6, layout: FULL },
  {
    id: 14, goal: { type: 'jelly' }, colors: 5,
    layout: [
      '222...222',
      '222...222',
      '222...222',
      '.........',
      '.........',
      '.........',
      '111...111',
      '111...111',
      '111...111',
    ],
  },
  { id: 15, goal: { type: 'ingredients', count: 3 }, colors: 5, layout: FULL },

  // 16–20: bigger boards to clear
  {
    id: 16, goal: { type: 'jelly' }, colors: 5,
    layout: [' 1111111 ', ...fill('1', 7), ' 1111111 '],
  },
  { id: 17, goal: { type: 'score' }, moves: 22, colors: 6, layout: DIAMOND },
  { id: 18, goal: { type: 'ingredients', count: 4 }, colors: 5, layout: HOURGLASS },
  {
    id: 19, goal: { type: 'jelly' }, colors: 5,
    layout: [
      '222222222',
      '2.......2',
      '2.......2',
      '2.......2',
      '2.......2',
      '2.......2',
      '2.......2',
      '2.......2',
      '222222222',
    ],
  },
  {
    id: 20, goal: { type: 'jelly' }, colors: 5,
    layout: [
      '   111   ',
      '   111   ',
      '   111   ',
      '111111111',
      '111222111',
      '111111111',
      '   111   ',
      '   111   ',
      '   111   ',
    ],
  },

  // 21–25: split boards and harder mixes
  { id: 21, goal: { type: 'ingredients', count: 4 }, colors: 6, layout: FULL },
  {
    id: 22, goal: { type: 'jelly' }, colors: 5,
    layout: [
      '111111111',
      '111111111',
      '111 1 111',
      '111 1 111',
      '111 1 111',
      '111 1 111',
      '111 1 111',
      '111111111',
      '111111111',
    ],
  },
  { id: 23, goal: { type: 'score' }, moves: 24, colors: 6, layout: CORNERS },
  {
    id: 24, goal: { type: 'ingredients', count: 3 }, colors: 6,
    layout: [
      '   ...   ',
      '   ...   ',
      '   ...   ',
      '.........',
      '.........',
      '.........',
      '   ...   ',
      '   ...   ',
      '   ...   ',
    ],
  },
  {
    id: 25, goal: { type: 'jelly' }, colors: 5,
    layout: [
      ' 1111111 ',
      '111111111',
      '112222211',
      '112222211',
      '112222211',
      '112222211',
      '112222211',
      '111111111',
      ' 1111111 ',
    ],
  },

  // 26–30: the finale
  { id: 26, goal: { type: 'ingredients', count: 4 }, colors: 6, layout: FULL },
  {
    id: 27, goal: { type: 'jelly' }, colors: 5,
    layout: Array.from({ length: 9 }, (_, r) =>
      Array.from({ length: 9 }, (_, c) => ((r + c) % 2 ? '2' : '1')).join('')),
  },
  { id: 28, goal: { type: 'score' }, moves: 22, colors: 6, layout: HOURGLASS },
  { id: 29, goal: { type: 'ingredients', count: 4 }, colors: 6, layout: DIAMOND },
  {
    id: 30, goal: { type: 'jelly' }, colors: 5,
    layout: fill('2'),
  },
];

export const LEVELS = LEVEL_DESIGNS.map((level) => ({ ...level, ...TUNING[level.id] }));

