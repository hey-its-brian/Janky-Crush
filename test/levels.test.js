import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL_DESIGNS } from '../src/levels.js';
import { parseLayout } from '../src/engine/level.js';

// Every open cell must be reachable by falling pieces: straight down from
// the top, down within its column, or by a diagonal slide from a reachable
// cell up and to the side. Otherwise a cleared cell under coconuts would
// stay empty for good.
function unreachable(layout) {
  const { rows, cols, mask, block } = parseLayout(layout);
  const open = (r, c) => r >= 0 && r < rows && c >= 0 && c < cols && mask[r][c] && !block[r][c];
  const ok = Array.from({ length: rows }, () => Array(cols).fill(false));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (!open(r, c)) continue;
      let above = null;
      for (let i = r - 1; i >= 0; i--) if (mask[i][c]) { above = i; break; }
      const fromTop = above === null || (open(above, c) && ok[above][c]);
      const fromSide = [-1, 1].some((dc) => open(r - 1, c + dc) && ok[r - 1][c + dc]);
      ok[r][c] = fromTop || fromSide;
    }
  const bad = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (open(r, c) && !ok[r][c]) bad.push([r, c]);
  return bad;
}

test('every open cell can be refilled', () => {
  const bad = LEVEL_DESIGNS.map((l) => [l.id, unreachable(l.layout)]).filter(([, cells]) => cells.length);
  assert.deepEqual(bad, []);
});

test('layouts are 9 rows of 9', () => {
  for (const level of LEVEL_DESIGNS) {
    assert.equal(level.layout.length, 9, `level ${level.id}`);
    for (const row of level.layout) assert.equal(row.length, 9, `level ${level.id}: "${row}"`);
  }
});

test('coconut levels have coconuts, collect levels have targets', () => {
  for (const level of LEVEL_DESIGNS) {
    if (level.goal.type === 'coconuts') assert.ok(level.layout.join('').match(/[kK]/), `level ${level.id}`);
    if (level.goal.type === 'collect') assert.ok(Object.keys(level.goal.targets).length, `level ${level.id}`);
  }
});
