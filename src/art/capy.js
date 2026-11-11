// The host: a chubby capybara with a yuzu on its head. The poses are
// generated pictures, cut out as sprites in art/host/ (tools/cut-art.py,
// art/host/PROMPTS.md). All three share one frame, so the character keeps
// its size and place when the pose changes.

export const HOST_POSES = ['idle', 'cheer', 'worried'];

export function capy(pose = 'idle') {
  return `<img src="./art/host/${HOST_POSES.includes(pose) ? pose : 'idle'}.webp" alt="" decoding="async">`;
}
