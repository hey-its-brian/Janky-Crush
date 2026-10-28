// Levels 1–40. Each level's layout, goal and number of fruit colors is
// designed here; its moves (for every goal but score) and star scores come
// from level-tuning.js, which tools/tune.mjs writes by having a computer
// player play every level many times.
//
// Layout: 9 strings of 9. ' ' not on the board, '.' plain, '1' foam,
// '2' double foam, 'k' coconut, 'K' big coconut. See src/engine/level.js.
//
// Goals: score, jelly (clear the foam), ingredients (bring friends down),
// coconuts (crack them all), collect (gather so many of each fruit).

import { TUNING } from './level-tuning.js';

const fill = (ch, n = 9) => Array(n).fill(ch.repeat(9));
const rows = (...pairs) => pairs.flatMap(([row, n]) => Array(n).fill(row));
// Swap the plain cells of a shape for another character.
const paint = (shape, ch) => shape.map((r) => r.replaceAll('.', ch));

// ---- board shapes ----------------------------------------------------------

const FULL = fill('.');
const CORNERS = [' ....... ', ...fill('.', 7), ' ....... '];
const DIAMOND = ['  .....  ', ' ....... ', ...fill('.', 5), ' ....... ', '  .....  '];
const HOURGLASS = [
  '.........', ' ....... ', '  .....  ', '   ...   ', '   ...   ', '   ...   ', '  .....  ', ' ....... ', '.........',
];
const NARROW = Array(9).fill(' ....... ');
const HEART = [
  ' ..   .. ', '.... ....', '.........', '.........', '.........', ' ....... ', '  .....  ', '   ...   ', '    .    ',
];
const DONUT = rows(['.........', 3], ['...   ...', 3], ['.........', 3]);
const PLUS = rows(['  .....  ', 3], ['.........', 3], ['  .....  ', 3]);
const STAIRS = [
  '.....    ', '......   ', '.......  ', '........ ', '.........', ' ........', '  .......', '   ......', '    .....',
];
const TWIN = rows(['...   ...', 5], ['.........', 4]);
const ARROW = ['    .    ', '   ...   ', '  .....  ', ' ....... ', '.........', ...rows(['  .....  ', 4])];
const WAVES = [
  '.........', '.. ... ..', '.........', '.........', '. ..... .', '.........', '.........', '.. ... ..', '.........',
];
const BRIDGE = rows(['.........', 3], ['..     ..', 3], ['.........', 3]);

export const LEVEL_DESIGNS = [
  // 1–5: the basics, and each kind of goal
  { id: 1, goal: { type: 'score' }, moves: 20, colors: 5, layout: CORNERS },
  { id: 2, goal: { type: 'collect', targets: { r: 12 } }, colors: 5, layout: DIAMOND },
  {
    id: 3, goal: { type: 'jelly' }, colors: 5,
    layout: [' ....... ', '.........', '.........', '...111...', '...111...', '...111...', '.........', '.........', ' ....... '],
  },
  {
    id: 4, goal: { type: 'coconuts' }, colors: 5,
    layout: ['.........', '.........', '.........', '.........', 'k.k.k.k.k', '.........', '.........', '.........', '.........'],
  },
  { id: 5, goal: { type: 'score' }, moves: 20, colors: 5, layout: HEART },

  // 6–10: friends to rescue, mixed goals
  { id: 6, goal: { type: 'ingredients', count: 2 }, colors: 5, layout: NARROW },
  { id: 7, goal: { type: 'collect', targets: { o: 20, g: 20 } }, colors: 5, layout: DONUT },
  {
    id: 8, goal: { type: 'jelly' }, colors: 5,
    layout: ['1.......1', '.1.....1.', '..1...1..', '...1.1...', '....1....', '...1.1...', '..1...1..', '.1.....1.', '1.......1'],
  },
  {
    id: 9, goal: { type: 'coconuts' }, colors: 5,
    layout: ['  .....  ', '  .....  ', '  .k.k.  ', '.k.....k.', '.........', '.k.....k.', '  .k.k.  ', '  .....  ', '  .....  '],
  },
  { id: 10, goal: { type: 'score' }, moves: 22, colors: 6, layout: STAIRS },

  // 11–15: big coconuts and double foam
  { id: 11, goal: { type: 'ingredients', count: 3 }, colors: 5, layout: ARROW },
  {
    id: 12, goal: { type: 'coconuts' }, colors: 5,
    layout: ['.........', '.........', '.........', 'K.K...K.K', '...K.K...', 'K.K...K.K', '.........', '.........', '.........'],
  },
  { id: 13, goal: { type: 'collect', targets: { b: 25, y: 25 } }, colors: 5, layout: PLUS },
  {
    id: 14, goal: { type: 'jelly' }, colors: 5,
    layout: ['.........', '.........', '..11111..', '..12221..', '..12k21..', '..12221..', '..11111..', '.........', '.........'],
  },
  { id: 15, goal: { type: 'ingredients', count: 3 }, colors: 5, layout: TWIN },

  // 16–20: shapes get trickier
  {
    id: 16, goal: { type: 'coconuts' }, colors: 5,
    layout: ['...   ...', '.K.   .K.', '...   ...', 'k.k   k.k', '...   ...', '.........', '.K.k.k.K.', '.........', 'k.k.k.k.k'],
  },
  { id: 17, goal: { type: 'jelly' }, colors: 5, layout: paint(HEART, '1') },
  { id: 18, goal: { type: 'collect', targets: { r: 25, p: 25, g: 25 } }, colors: 6, layout: FULL },
  {
    id: 19, goal: { type: 'coconuts' }, colors: 5,
    layout: ['k.k.k.k.k', ' ....... ', '  K.k.K  ', '   ...   ', '   .k.   ', '   ...   ', '  k.K.k  ', ' ....... ', '.K.K.K.K.'],
  },
  { id: 20, goal: { type: 'score' }, moves: 24, colors: 6, layout: DONUT },

  // 21–25: coconuts guard the foam
  {
    id: 21, goal: { type: 'jelly' }, colors: 5,
    layout: ['111111111', '1k.k.k.k1', '1.......1', '1.......1', '1.......1', '1.......1', '1.......1', '1k.k.k.k1', '111111111'],
  },
  {
    id: 22, goal: { type: 'ingredients', count: 3 }, colors: 5,
    layout: ['.........', '.........', '.k.....k.', '.........', '...k.k...', '.........', '.k.....k.', '.........', '.........'],
  },
  { id: 23, goal: { type: 'collect', targets: { y: 35, b: 35 } }, colors: 5, layout: HEART },
  { id: 24, goal: { type: 'jelly' }, colors: 5, layout: [...paint(DIAMOND.slice(0, 2), '1'), ...paint(DIAMOND.slice(2, 7), '2'), ...paint(DIAMOND.slice(7), '1')] },
  {
    id: 25, goal: { type: 'coconuts' }, colors: 5,
    layout: ['.........', '.K.K.K.K.', '.........', 'k.k.k.k.k', '.........', '.K.K.K.K.', '.........', 'k.k.k.k.k', '.........'],
  },

  // 26–30: harder mixes
  { id: 26, goal: { type: 'ingredients', count: 3 }, colors: 5, layout: DONUT },
  { id: 27, goal: { type: 'collect', targets: { o: 30, r: 30, p: 30 } }, colors: 6, layout: WAVES },
  {
    id: 28, goal: { type: 'jelly' }, colors: 5,
    layout: ['222222222', '2.......2', '2.k.k.k.2', '2.......2', '2.......2', '2.......2', '2.k.k.k.2', '2.......2', '222222222'],
  },
  {
    id: 29, goal: { type: 'coconuts' }, colors: 5,
    layout: ['.....    ', '.K.k..   ', '.k...K.  ', '...K...k ', '.k..K..k.', ' K...K..K', '  .k...k.', '   .Kk.K.', '    .....'],
  },
  { id: 30, goal: { type: 'score' }, moves: 24, colors: 6, layout: BRIDGE },

  // 31–35: the deep end
  { id: 31, goal: { type: 'ingredients', count: 4 }, colors: 6, layout: FULL },
  {
    id: 32, goal: { type: 'jelly' }, colors: 5,
    layout: ['111111111', '111111111', '1k1k1k1k1', '222222222', '222222222', '222222222', '1k1k1k1k1', '111111111', '111111111'],
  },
  { id: 33, goal: { type: 'collect', targets: { r: 30, o: 30, y: 30, g: 30 } }, colors: 6, layout: FULL },
  {
    id: 34, goal: { type: 'coconuts' }, colors: 5,
    layout: ['  .....  ', '  K.K.K  ', '.........', 'K.......K', 'K..K.K..K', 'K.......K', '.........', '  K.K.K  ', '  .....  '],
  },
  { id: 35, goal: { type: 'score' }, moves: 22, colors: 6, layout: HEART },

  // 36–40: the finale
  { id: 36, goal: { type: 'jelly' }, colors: 5, layout: paint(STAIRS, '2') },
  { id: 37, goal: { type: 'ingredients', count: 3 }, colors: 6, layout: TWIN },
  { id: 38, goal: { type: 'collect', targets: { b: 45, g: 45 } }, colors: 6, layout: DONUT },
  {
    id: 39, goal: { type: 'coconuts' }, colors: 5,
    layout: ['.........', '.K.K.K.K.', 'K.K.K.K.K', '.........', '.........', '.........', 'k.k.k.k.k', '.k.k.k.k.', '.........'],
  },
  {
    id: 40, goal: { type: 'jelly' }, colors: 5,
    layout: ['222222222', '222222222', '222222222', '222k2k222', '2222K2222', '222k2k222', '222222222', '222222222', '222222222'],
  },
];

export const LEVELS = LEVEL_DESIGNS.map((level) => ({ ...level, ...TUNING[level.id] }));
