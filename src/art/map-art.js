// The level map's scenery and characters. These are generated pictures, cut
// out as sprites in art/map/ (see tools/cut-map-art.py and
// art/map/PROMPTS.md). `art('palm:flip')` gives the mirrored sprite.

export function art(name) {
  const [file, flip] = name.split(':');
  return `<img${flip ? ' class="flip"' : ''} src="./art/map/${file}.webp" alt="" loading="lazy" decoding="async">`;
}
