// The recorded music: looped ska tracks in music/, made by
// tools/make-music.py. `start` and `length` are the loop in seconds (each
// file has a short lead-in before the loop and a tail after it). `synth` is
// the built-in song that plays if a file cannot be loaded.

export const TRACKS = {
  title: { start: 0.25, length: 64.0, synth: 0 },     // two tone
  map1: { start: 0.25, length: 68.5712, synth: 0 },   // rocksteady
  map2: { start: 0.25, length: 68.2551, synth: 0 },   // rocksteady
  wheel: { start: 0.25, length: 80.0, synth: 2 },     // ska punk
  blend: { start: 0.25, length: 61.44, synth: 1 },    // classic ska
  ska: { start: 0.25, length: 61.3558, synth: 1 },    // classic ska
  tone: { start: 0.25, length: 64.8637, synth: 2 },   // two tone
  punk: { start: 0.25, length: 75.327, synth: 2 },    // ska punk
  isle2: { start: 0.25, length: 47.9998, synth: 0 },  // tropical
  isle1: { start: 0.25, length: 67.2, synth: 0 },     // tropical
};

// Levels that are not smoothie levels take turns through these.
export const LEVEL_TRACKS = ['ska', 'tone', 'punk', 'isle2', 'isle1'];

// Smoothie (collect) levels have their own track.
export function trackForLevel(level) {
  if (level.goal?.type === 'collect') return 'blend';
  return LEVEL_TRACKS[(level.id - 1) % LEVEL_TRACKS.length];
}

// The map: one track for the first five areas, one for the later areas.
export const trackForMap = (zone) => (zone <= 5 ? 'map1' : 'map2');
