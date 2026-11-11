// Levels 1–60. Each level's layout, goal and number of fruit colors is
// designed here; its moves (for every goal but score) and star scores come
// from level-tuning.js, which tools/tune.mjs writes by having a computer
// player play every level many times.
//
// Layout: 9 strings of 9. ' ' not on the board, '.' plain, '1' foam,
// '2' double foam, 'k'/'K' coconut, 'm'/'M' mochi (one or two layers),
// 'u' gummy cube, 'L' locked fruit, 'l' locked fruit on foam. See
// src/engine/level.js. `dispensers` put a spout above a column that drops
// in a special or a gummy every few refills. `portals` join cells:
// [fromRow, fromCol, toRow, toCol, color]: fruit that falls out of the
// bottom of the first cell comes in at the top of the second. Every part
// of a column that is cut off from the top by a portal needs a portal that
// comes in at its top, or it can never refill. `tip` is a line for the
// level's intro.
//
// Goals: score, jelly (clear the foam), ingredients (bring friends down),
// blockers (clear every coconut, mochi and gummy), collect (gather so many of each fruit).

import { TUNING } from './level-tuning.js';

const fill = (ch, n = 9) => Array(n).fill(ch.repeat(9));
const rows = (...pairs) => pairs.flatMap(([row, n]) => Array(n).fill(row));
// Swap the plain cells of a shape for another character.
const paint = (shape, ch) => shape.map((r) => r.replaceAll('.', ch));

// Portals from one row to another: column fromCols[i] of `fromRow` drops
// into column toCols[i] of `toRow`. With no `color`, each gets its own.
const ALL = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const MIRROR = [8, 7, 6, 5, 4, 3, 2, 1, 0];
const across = (fromRow, fromCols, toRow, toCols, color = null) =>
  fromCols.map((c, i) => [fromRow, c, toRow, toCols[i], color ?? i]);

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
    id: 4, goal: { type: 'blockers' }, colors: 5,
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
    id: 9, goal: { type: 'blockers' }, colors: 5,
    layout: ['.........', '.........', '.m.m.m.m.', '.........', 'm.m.m.m.m', '.........', '.m.m.m.m.', '.........', '.........'],
  },
  { id: 10, goal: { type: 'score' }, moves: 22, colors: 6, layout: STAIRS },

  // 11–15: big coconuts, double foam and gummy cubes
  { id: 11, goal: { type: 'ingredients', count: 3 }, colors: 5, layout: ARROW },
  {
    id: 12, goal: { type: 'blockers' }, colors: 5,
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
    id: 16, goal: { type: 'blockers' }, colors: 5,
    layout: ['...   ...', '.u.   .u.', '...   ...', 'u.u   u.u', '...   ...', '.........', '.u.u.u.u.', '.........', 'u.u.u.u.u'],
  },
  { id: 17, goal: { type: 'jelly' }, colors: 5, layout: paint(HEART, '1') },
  { id: 18, goal: { type: 'collect', targets: { r: 25, p: 25, g: 25 } }, colors: 6, layout: FULL },
  { id: 19, goal: { type: 'jelly' }, colors: 5, layout: paint(HOURGLASS, '1'), dispensers: [{ col: 4, kind: 'stripe', every: 3 }] },
  { id: 20, goal: { type: 'score' }, moves: 24, colors: 6, layout: DONUT },

  // 21–25: blockers guard the foam
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
    id: 25, goal: { type: 'blockers' }, colors: 5,
    layout: ['.........', '.mm.mm.m.', '.MM.MM.M.', '.mm.mm.m.', '.MM.MM.M.', 'u.uu.uu.u', '.u..u..u.', '.........', '.........'],
  },

  // 26–30: harder mixes
  { id: 26, goal: { type: 'ingredients', count: 3 }, colors: 5, layout: DONUT },
  { id: 27, goal: { type: 'collect', targets: { o: 30, r: 30, p: 30 } }, colors: 6, layout: WAVES },
  {
    id: 28, goal: { type: 'jelly' }, colors: 5,
    layout: ['222222222', '2.......2', '2.k.k.k.2', '2.......2', '2.......2', '2.......2', '2.k.k.k.2', '2.......2', '222222222'],
  },
  {
    id: 29, goal: { type: 'blockers' }, colors: 5,
    layout: ['.........', '.KK...KK.', '.kk.m.kk.', '.KK...KK.', '...M.M...', '.........', '.k.k.k.k.', '.........', '.........'],
    dispensers: [{ col: 4, kind: 'bomb', every: 6 }],
  },
  { id: 30, goal: { type: 'score' }, moves: 24, colors: 6, layout: BRIDGE, dispensers: [{ col: 4, kind: 'wrapped', every: 5 }] },

  // 31–35: the deep end
  { id: 31, goal: { type: 'ingredients', count: 4 }, colors: 6, layout: FULL },
  {
    id: 32, goal: { type: 'jelly' }, colors: 5,
    layout: ['111111111', '111111111', '1k1k1k1k1', '222222222', '222222222', '222222222', '1k1k1k1k1', '111111111', '111111111'],
  },
  { id: 33, goal: { type: 'collect', targets: { r: 30, o: 30, y: 30, g: 30 } }, colors: 6, layout: FULL },
  {
    id: 34, goal: { type: 'collect', targets: { r: 30, b: 30 } }, colors: 5,
    layout: ['.........', 'u.u.u.u.u', '.u.u.u.u.', 'u.u.u.u.u', '.........', '.........', '.u.u.u.u.', '.........', '.........'],
    dispensers: [{ col: 2, kind: 'gummy', every: 4 }, { col: 6, kind: 'gummy', every: 4 }],
  },
  { id: 35, goal: { type: 'score' }, moves: 22, colors: 6, layout: HEART },

  // 36–40: the finale
  { id: 36, goal: { type: 'jelly' }, colors: 5, layout: paint(STAIRS, '2') },
  { id: 37, goal: { type: 'ingredients', count: 3 }, colors: 6, layout: TWIN },
  { id: 38, goal: { type: 'collect', targets: { b: 45, g: 45 } }, colors: 6, layout: DONUT },
  {
    id: 39, goal: { type: 'blockers' }, colors: 5,
    layout: ['.........', '.MM.u.MM.', '.mm...mm.', 'u.u.M.u.u', '.KK...KK.', '.kk.u.kk.', '.........', 'k.k.k.k.k', '.........'],
    dispensers: [{ col: 4, kind: 'bomb', every: 7 }],
  },
  {
    id: 40, goal: { type: 'jelly' }, colors: 5,
    layout: ['222222222', '222222222', '222222222', '222k2k222', '2222K2222', '222k2k222', '222222222', '222222222', '222222222'],
  },

  // ---- Bamboo Falls: locked fruit -----------------------------------------

  // 41–45: cages, then cages with each kind of goal
  {
    id: 41, goal: { type: 'score' }, moves: 22, colors: 5,
    tip: 'New: locked fruit. A cage holds it in place. Match it to open the cage.',
    layout: ['.........', '.........', '.........', '..L.L.L..', '.........', '..L.L.L..', '.........', '.........', '.........'],
  },
  {
    id: 42, goal: { type: 'collect', targets: { g: 30, o: 30 } }, colors: 5,
    layout: ['.L.L.L.L.', '.........', 'L.L.L.L.L', '.........', '.L.L.L.L.', '.........', '.........', '.........', '.........'],
  },
  {
    id: 43, goal: { type: 'jelly' }, colors: 5,
    layout: ['.........', '.l.l.l.l.', '.1.1.1.1.', '.l.l.l.l.', '.1.1.1.1.', '.l.l.l.l.', '.1.1.1.1.', '.........', '.........'],
  },
  {
    id: 44, goal: { type: 'blockers' }, colors: 5,
    layout: ['.........', '..L...L..', '.KLK.KLK.', '..L...L..', '.........', '.M.m.M.m.', '..L...L..', 'K.K.K.K.K', '.........'],
  },
  {
    id: 45, goal: { type: 'ingredients', count: 2 }, colors: 5,
    layout: [' ....... ', ' ....... ', ' .L.L.L. ', ' ....... ', ' ....... ', ' L.L.L.L ', ' ....... ', ' ....... ', ' ....... '],
  },

  // 46–50: more cages, tighter boards
  {
    id: 46, goal: { type: 'collect', targets: { r: 25, b: 25 } }, colors: 5,
    layout: [' ..   .. ', '.... ....', '..L...L..', '.........', '...L.L...', ' ....... ', '  .....  ', '   ...   ', '    .    '],
  },
  {
    id: 47, goal: { type: 'jelly' }, colors: 5,
    layout: ['l.......l', '.l.....l.', '..2...2..', '...2.2...', '....2....', '...2.2...', '..2...2..', '.l.....l.', 'l.......l'],
  },
  {
    id: 48, goal: { type: 'blockers' }, colors: 5,
    layout: ['.........', '.L.u.u.L.', '..K...K..', 'u.L.u.L.u', '.........', '.u.L.L.u.', '..K...K..', 'M.M.M.M.M', '.........'],
    dispensers: [{ col: 2, kind: 'gummy', every: 4 }, { col: 6, kind: 'gummy', every: 4 }],
  },
  {
    id: 49, goal: { type: 'score' }, moves: 24, colors: 5,
    layout: ['.........', '.L.L.L.L.', '.........', '...   ...', '.L.   .L.', '...   ...', '.........', '.L.L.L.L.', '.........'],
  },
  {
    id: 50, goal: { type: 'jelly' }, colors: 5,
    layout: ['111111111', '1l1l1l1l1', '111111111', '1l1l1l1l1', '111111111', '1l1l1l1l1', '111111111', '111111111', '111111111'],
  },

  // ---- Firefly Grove: portals ---------------------------------------------

  // 51–55: portals, then portals with each kind of goal
  {
    id: 51, goal: { type: 'score' }, moves: 22, colors: 4,
    tip: 'New: portals. Fruit that falls into a glowing ring comes out of the ring of the same color.',
    layout: [...rows(['.... ....', 4]), '         ', ...rows(['.... ....', 4])],
    // The top left island drops into the bottom right one, and the top right into the bottom left.
    portals: [...across(3, [0, 1, 2, 3], 5, [5, 6, 7, 8], 0), ...across(3, [5, 6, 7, 8], 5, [0, 1, 2, 3], 1)],
  },
  {
    id: 52, goal: { type: 'collect', targets: { y: 25, g: 25 } }, colors: 5,
    layout: [...fill('.', 4), '         ', ...fill('.', 4)],
    portals: across(3, ALL, 5, MIRROR),
  },
  {
    id: 53, goal: { type: 'jelly' }, colors: 5,
    layout: [...rows(['   ...   ', 3]), '         ', '111111111', ...rows(['1.......1', 3]), '111111111'],
    portals: across(2, [3, 4, 5], 4, [5, 4, 3]),
  },
  {
    id: 54, goal: { type: 'ingredients', count: 3 }, colors: 5,
    layout: FULL,
    // The left side drains out of the bottom into the top of the right side.
    portals: across(8, [0, 1, 2, 3], 0, [5, 6, 7, 8]),
  },
  {
    id: 55, goal: { type: 'blockers' }, colors: 5,
    layout: [...fill('.', 3), '         ', '.K.K.K.K.', '.........', '..L.L.L..', '.M.M.M.M.', '.........'],
    portals: across(2, ALL, 4, MIRROR),
  },

  // 56–60: longer trips, and portals with everything else
  {
    id: 56, goal: { type: 'score' }, moves: 24, colors: 5,
    layout: [...fill('.', 3), '         ', ...fill('.', 2), '         ', ...fill('.', 2)],
    // Three bands. Each drop moves the fruit three columns over.
    portals: [...across(2, ALL, 4, ALL.map((c) => (c + 3) % 9)), ...across(5, ALL, 7, ALL.map((c) => (c + 3) % 9))],
  },
  {
    id: 57, goal: { type: 'jelly' }, colors: 5,
    layout: ['....l....', '...l1l...', '..l111l..', '.l11111l.', '         ', '.l11111l.', '..l111l..', '...l1l...', '....l....'],
    portals: across(3, ALL, 5, MIRROR),
  },
  {
    id: 58, goal: { type: 'collect', targets: { r: 20, o: 20, b: 20 } }, colors: 5,
    layout: ['.........', ' ....... ', '  .....  ', '         ', '         ', '         ', '  .....  ', ' ....... ', '.........'],
    portals: across(2, [2, 3, 4, 5, 6], 6, [6, 5, 4, 3, 2]),
  },
  {
    id: 59, goal: { type: 'blockers' }, colors: 5,
    layout: [...fill('.', 3), '         ', 'M.M.M.M.M', '.........', 'u.u.u.u.u', '.K.K.K.K.', '.........'],
    portals: across(2, ALL, 4, MIRROR),
    dispensers: [{ col: 2, kind: 'gummy', every: 5 }, { col: 6, kind: 'gummy', every: 5 }],
  },
  {
    id: 60, goal: { type: 'jelly' }, colors: 5,
    layout: ['222222222', '2l22222l2', '222222222', '         ', '111111111', '1k11111k1', '111111111', '111111111', '111111111'],
    portals: across(2, ALL, 4, MIRROR),
  },
];

export const LEVELS = LEVEL_DESIGNS.map((level) => ({ ...level, ...TUNING[level.id] }));
