// The animated hot-spring scene behind the board: sky with turning sun
// rays, drifting clouds, swaying palms, rolling hills, a steaming pool with
// bobbing duckies and fluttering butterflies. Pure decoration, built once.
// All the SVG here is our own art, never user input.

import { palm, cloud, hills, steam, flower, bush, butterfly, sun } from '../art/scene.js';
import { ducky } from '../art/pieces.js';

const sprite = (svg, style, cls = '') => `<div class="sprite ${cls}" style="${style}">${svg}</div>`;

export function buildWorld(el) {
  // Positions are in % of the screen so it fits any phone size.
  const steams = [[8, 82, 0], [26, 85, 1.2], [66, 84, 2.1], [86, 80, 0.6], [46, 87, 2.8]]
    .map(([x, y, d]) => sprite(steam(), `left:${x}%;top:${y}%;animation-delay:-${d}s`, 'steam')).join('');
  el.innerHTML = `
    <div class="sky"></div><div class="rays"></div>
    ${sprite(sun(), 'right:4%;top:4%;width:96px;height:96px', 'bob')}
    ${sprite(cloud(), 'left:4%;top:16%;width:140px;height:70px', 'cloud')}
    ${sprite(cloud(), 'left:-30%;top:24%;width:100px;height:50px;animation-delay:-20s', 'cloud slow')}
    ${sprite(hills(), 'left:0;right:0;top:46%;width:100%;height:20%', 'stretch')}
    ${sprite(palm(), 'left:-10%;top:32%;width:34%;height:32%', 'sway')}
    ${sprite(palm(true), 'right:-12%;top:27%;width:36%;height:35%', 'sway b')}
    ${sprite(bush(), 'left:34%;top:60%;width:27%;height:6%')}
    ${sprite(flower(), 'left:27%;top:64%;width:30px;height:30px')}
    ${sprite(flower('#ffb02e'), 'left:68%;top:64%;width:26px;height:26px')}
    <div class="water"></div>
    ${steams}
    ${sprite(ducky(), 'left:76%;top:88%;width:56px;height:56px', 'bob')}
    ${sprite(ducky(), 'left:58%;top:92%;width:42px;height:42px', 'bob b')}
    ${sprite(butterfly(), 'left:14%;top:26%;width:34px;height:26px', 'flutter')}
    ${sprite(butterfly('#ff6fae'), 'left:60%;top:19%;width:30px;height:22px;animation-delay:-3s', 'flutter')}`;
}
