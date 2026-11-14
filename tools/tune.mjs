// Level tuner: a computer player plays every level many times, and the
// results set each level's moves and star scores so difficulty climbs
// smoothly. Writes src/level-tuning.js.
//
//   node tools/tune.mjs              all levels
//   node tools/tune.mjs 3 7          just levels 3 and 7 (others kept)
//   GAMES=40 node tools/tune.mjs     fewer games per level (faster, rougher)

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LEVEL_DESIGNS } from '../src/levels.js';
import { setupBoard, LevelState } from '../src/engine/level.js';
import { runTurn, runBonus } from '../src/engine/turn.js';
import { INGREDIENT, BOMB, WRAPPED } from '../src/engine/board.js';
import { makeRng } from '../src/rng.js';

const GAMES = Number(process.env.GAMES ?? 80);
const MAX_MOVES = 90;
const MOVE_CAP = 50; // no level asks for more than this
const OUT = fileURLToPath(new URL('../src/level-tuning.js', import.meta.url));

// How often the computer player should win, by level. It plays greedily
// (best move right now, no planning), so people tend to do a bit better.
export function targetWinRate(id) {
  if (id <= 3) return 0.99;
  if (id <= 5) return 0.95;
  if (id <= 10) return 0.85;
  if (id <= 15) return 0.78;
  if (id <= 20) return 0.72;
  if (id <= 25) return 0.65;
  if (id <= 32) return 0.6;
  if (id <= 60) return 0.55;
  // From here the prize wheel hands out boosters, so the levels ask more.
  return 0.48;
}

// ---- the computer player ---------------------------------------------------

function specialsValue(board) {
  let v = 0;
  for (const row of board.grid)
    for (const c of row) {
      if (!c?.special || c.special === INGREDIENT) continue;
      v += c.special === BOMB ? 500 : c.special === WRAPPED ? 250 : 150;
    }
  return v;
}

function ingredientDepth(board) {
  let d = 0;
  for (let r = 0; r < board.rows; r++)
    for (const c of board.grid[r]) if (c?.special === INGREDIENT) d += r;
  return d;
}

// Plays like a person: judges each move only by what you can see before
// making it (the match, any special it makes or sets off, jelly and
// coconuts it hits, fruit it gathers, how far ingredients would drop), not
// by cascades that follow.
function botMove(level, board, state, rng) {
  const before = {
    jelly: board.jellyCount(),
    blocks: board.blockCount() + board.gummyCount(),
    depth: ingredientDepth(board),
    specials: specialsValue(board),
    jam: board.jamCount(),
  };
  const wanted = state.collectLeft();
  let best = null, bestValue = -Infinity;
  for (let r = 0; r < board.rows; r++)
    for (let c = 0; c < board.cols; c++)
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const a = [r, c], b = [r + dr, c + dc];
        if (!board.isValidSwap(a, b)) continue;
        const copy = board.clone(makeRng(Math.floor(rng() * 2 ** 32)));
        const combo = copy.isComboSwap(a, b);
        copy.swap(a, b);
        const step = combo ? copy.comboStep(a, b) : copy.resolveStep({ from: a, to: b });
        let points = step?.points ?? 0;
        const cleared = [...(step?.cleared ?? [])];
        let unlocked = step?.unlocked?.length ?? 0;
        if (step?.primed) {
          const fired = copy.firePrimed();
          points += fired?.points ?? 0;
          cleared.push(...(fired?.cleared ?? []));
          unlocked += fired?.unlocked?.length ?? 0;
        }
        copy.applyGravity();
        // Timer fruit: stopping one is worth more the lower its count, and
        // a move that leaves one to go off is the worst there is.
        let timers = 0;
        for (const x of cleared) if (x.timer != null) timers += 3000 / Math.max(1, x.timer);
        for (const row of copy.grid) for (const c of row) if (c?.timer != null && !c.fresh && c.timer <= 1) timers -= 1e6;
        const gathered = cleared.filter((x) => wanted[x.color] > 0).length;
        // The last few jellies are worth chasing harder, as a person would.
        const jellyWeight = 400 * (1 + 6 / (before.jelly + 1));
        const value =
          points +
          jellyWeight * (before.jelly - copy.jellyCount()) +
          350 * (1 + 4 / (before.blocks + 1)) * (before.blocks - copy.blockCount() - copy.gummyCount()) +
          90 * gathered +
          150 * unlocked + // a person opens cages when they can
          250 * (ingredientDepth(copy) - before.depth) +
          (specialsValue(copy) - before.specials) +
          timers +
          (before.jam && copy.jamCount() < before.jam ? 300 : 0) + // a move that clears jam also stops it growing
          rng() * 40;
        if (value > bestValue) [best, bestValue] = [[a, b], value];
      }
  return best;
}

function playGame(level, seed, moves) {
  const rng = makeRng(seed);
  const lvl = { ...level, moves, stars: level.stars ?? [1, 2, 3] };
  const board = setupBoard(lvl, makeRng(seed * 7919 + 1));
  const state = new LevelState(lvl, board);
  let used = 0;
  while (!state.isOver()) {
    const move = botMove(lvl, board, state, rng);
    runTurn(board, state, ...move);
    used++;
  }
  const exploded = Boolean(state.exploded);
  const complete = state.isComplete() && !exploded;
  if (complete || (level.goal.type === 'score' && !exploded)) runBonus(board, state);
  // A score level that ends with a bang is lost, whatever the score.
  return { used, complete, exploded, score: exploded && level.goal.type === 'score' ? 0 : state.score };
}

// ---- tuning ----------------------------------------------------------------

const quantile = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * s.length)))];
};
const round = (n) => (n >= 10000 ? Math.round(n / 500) * 500 : Math.round(n / 100) * 100);

function tuneLevel(level) {
  const target = targetWinRate(level.id);
  const t0 = Date.now();
  let moves = level.moves;
  if (level.goal.type !== 'score') {
    // Pass 1: how many moves does it take to finish?
    const needed = [];
    for (let g = 0; g < GAMES; g++) {
      const r = playGame(level, 1000 + g, MAX_MOVES);
      needed.push(r.complete ? r.used : Infinity);
    }
    moves = Math.max(10, Math.min(MOVE_CAP, quantile(needed, target)));
  }
  // Pass 2: play with that many moves and read the scores. If the check
  // run comes in well under target, add a move and try again.
  let results;
  for (let tries = 0; ; tries++) {
    results = [];
    for (let g = 0; g < GAMES; g++) results.push(playGame(level, 5000 + g, moves));
    const wins = results.filter((r) => r.complete).length / results.length;
    if (level.goal.type === 'score' || wins >= target - 0.05 || moves >= MOVE_CAP || tries >= 4) break;
    moves++;
  }
  const scores = results.map((r) => r.score);
  let stars;
  if (level.goal.type === 'score') {
    stars = [round(quantile(scores, 1 - target)), round(quantile(scores, 0.65)), round(quantile(scores, 0.92))];
  } else {
    const won = results.filter((r) => r.complete).map((r) => r.score);
    const pool = won.length ? won : scores;
    stars = [round(quantile(pool, 0.05)), round(quantile(pool, 0.5)), round(quantile(pool, 0.88))];
  }
  for (let i = 1; i < 3; i++) if (stars[i] <= stars[i - 1]) stars[i] = stars[i - 1] + 500;
  stars[0] = Math.max(100, stars[0]);
  const winRate = level.goal.type === 'score'
    ? scores.filter((s) => s >= stars[0]).length / scores.length
    : results.filter((r) => r.complete).length / results.length;
  const boom = results.filter((r) => r.exploded).length / results.length;
  return { id: level.id, moves, stars, winRate, boom, target, seconds: Math.round((Date.now() - t0) / 1000) };
}

// ---- workers ---------------------------------------------------------------

if (!isMainThread) {
  for (const id of workerData.ids) {
    const level = LEVEL_DESIGNS.find((l) => l.id === id);
    parentPort.postMessage(tuneLevel(level));
  }
} else {
  const only = process.argv.slice(2).map(Number);
  const ids = LEVEL_DESIGNS.map((l) => l.id).filter((id) => !only.length || only.includes(id));
  // Hardest levels first so the workers finish together.
  ids.sort((a, b) => b - a);
  const n = Math.min(cpus().length, ids.length);
  const buckets = Array.from({ length: n }, (_, i) => ids.filter((_, j) => j % n === i));

  let existing = {};
  try {
    const text = readFileSync(OUT, 'utf8');
    existing = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1).replace(/,\s*}$/, '}') || '{}');
  } catch {
    existing = {};
  }

  const results = {};
  await Promise.all(buckets.map((bucket) => new Promise((resolve, reject) => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: { ids: bucket } });
    w.on('message', (r) => {
      results[r.id] = r;
      console.log(
        `level ${String(r.id).padStart(2)}  moves ${String(r.moves).padStart(2)}  ` +
        `stars ${r.stars.join(' / ').padEnd(22)}  bot wins ${Math.round(r.winRate * 100)}% ` +
        `(target ${Math.round(r.target * 100)}%)${r.boom ? `  timer went off ${Math.round(r.boom * 100)}%` : ''}  ${r.seconds}s`
      );
    });
    w.on('error', reject);
    w.on('exit', resolve);
  })));

  const tuning = { ...existing };
  for (const r of Object.values(results)) {
    const design = LEVEL_DESIGNS.find((l) => l.id === r.id);
    tuning[r.id] = design.goal.type === 'score' ? { stars: r.stars } : { moves: r.moves, stars: r.stars };
  }
  const sorted = Object.fromEntries(Object.entries(tuning).sort((a, b) => a[0] - b[0]));
  writeFileSync(OUT,
    '// Written by tools/tune.mjs. Do not edit by hand: re-run the tuner.\n' +
    'export const TUNING = {\n' +
    Object.entries(sorted).map(([id, t]) => `  "${id}": ${JSON.stringify(t)},`).join('\n') +
    '\n};\n');
  console.log(`wrote ${OUT}`);
}
