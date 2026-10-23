// Phase 1 has one practice level so the core feel can be tuned. Real level
// packs (jelly, ingredients, blockers) start in Phase 3.

const cornersCut = Array.from({ length: 9 }, (_, r) =>
  Array.from({ length: 9 }, (_, c) => !((r === 0 || r === 8) && (c === 0 || c === 8)))
);

export const LEVELS = [
  {
    id: 1,
    name: 'Practice',
    rows: 9,
    cols: 9,
    mask: cornersCut,
    moves: 20,
    // Score for 1, 2 and 3 stars.
    stars: [2000, 4500, 7000],
  },
];
