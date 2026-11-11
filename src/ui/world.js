// The scene behind the board: a painted hot-spring backdrop for each map
// zone (art/scene/zone1.webp ... zone4.webp), with steam rising from the
// water. Pure decoration. All the SVG here is our own art, never user input.

import { steam } from '../art/scene.js';

export const ZONE_BACKDROPS = 4;
const image = (zone) => `url("./art/scene/zone${Math.min(Math.max(zone, 1), ZONE_BACKDROPS)}.webp")`;

export function buildWorld(el) {
  // Positions are in % of the screen so it fits any phone size.
  const steams = [[8, 82, 0], [26, 85, 1.2], [66, 84, 2.1], [86, 80, 0.6], [46, 87, 2.8]]
    .map(([x, y, d]) => `<div class="sprite steam" style="left:${x}%;top:${y}%;animation-delay:-${d}s">${steam()}</div>`).join('');
  // On a wide screen the picture stays phone-shaped in the middle, over a
  // blurred copy of itself that fills the sides.
  el.innerHTML = `<div class="backdrop fill"></div><div class="backdrop"></div>${steams}`;
  setWorldZone(el, 1);
}

// Shows the backdrop of a map zone (1-based).
export function setWorldZone(el, zone) {
  for (const layer of el.querySelectorAll('.backdrop')) layer.style.backgroundImage = image(zone);
}
