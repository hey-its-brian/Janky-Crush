import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { TRACKS, LEVEL_TRACKS, trackForLevel, trackForMap } from '../src/audio/tracks.js';
import { LEVELS } from '../src/levels.js';

test('each track has a file, a loop and a built-in song to fall back on', () => {
  for (const [name, t] of Object.entries(TRACKS)) {
    assert.ok(existsSync(new URL(`../music/${name}.mp3`, import.meta.url)), name);
    assert.ok(t.start > 0 && t.length > 30, name);
    assert.ok([0, 1, 2].includes(t.synth), name);
  }
});

test('each level has a track; smoothie levels have their own', () => {
  for (const level of LEVELS) {
    const name = trackForLevel(level);
    assert.ok(TRACKS[name], `level ${level.id}`);
    assert.equal(name === 'blend', level.goal.type === 'collect', `level ${level.id}`);
  }
  assert.ok(LEVEL_TRACKS.every((name) => LEVELS.some((l) => trackForLevel(l) === name)));
});

test('the map changes track after the fifth area', () => {
  assert.equal(trackForMap(1), 'map1');
  assert.equal(trackForMap(5), 'map1');
  assert.equal(trackForMap(6), 'map2');
  assert.equal(trackForMap(10), 'map2');
});
