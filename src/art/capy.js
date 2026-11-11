// The host: a chubby capybara with a yuzu on its head. The poses are
// generated pictures, cut out as sprites in art/host/ (tools/cut-art.py,
// art/host/PROMPTS.md). All share one frame, so the character keeps its
// size and place when the pose changes.

export const HOST_POSES = ['idle', 'cheer', 'worried'];

export function capy(pose = 'idle') {
  const img = (name, cls = '') => `<img${cls} src="./art/host/${name}.webp" alt="" decoding="async">`;
  if (!HOST_POSES.includes(pose) || pose === 'idle') {
    // The idle host blinks: a second picture with closed eyes lies over the
    // first and shows for a moment now and then (styles.css).
    return img('idle') + img('blink', ' class="blink"');
  }
  return img(pose);
}
