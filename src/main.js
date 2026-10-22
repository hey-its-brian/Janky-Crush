import { Game } from './game.js';
import { LEVELS } from './levels.js';

const $ = (id) => document.getElementById(id);
const level = LEVELS[0];

const fmt = (n) => n.toLocaleString('en-US');

function renderStars(el, count) {
  [...el.children].forEach((star, i) => star.classList.toggle('on', i < count));
}

$('level-name').textContent = `Level ${level.id}`;
$('target').textContent = fmt(level.stars[0]);

const game = new Game($('board'), level, {
  onChange({ moves, score, stars }) {
    $('moves').textContent = moves;
    $('score').textContent = fmt(score);
    const top = level.stars[level.stars.length - 1];
    $('score-fill').style.width = `${Math.min(100, (score / top) * 100)}%`;
    renderStars($('score-stars'), stars);
  },
  onEnd({ score, stars, won }) {
    $('end-title').textContent = won ? 'Level complete' : 'Out of moves';
    $('end-score').textContent = fmt(score);
    renderStars($('end-stars'), stars);
    $('end').hidden = false;
  },
});

$('again').addEventListener('click', () => {
  $('end').hidden = true;
  game.start();
});

$('restart').addEventListener('click', () => {
  $('end').hidden = true;
  game.start();
});

// Position the score's star marks along the bar at their thresholds.
{
  const top = level.stars[level.stars.length - 1];
  [...$('score-marks').children].forEach((mark, i) => {
    mark.style.left = `${(level.stars[i] / top) * 100}%`;
  });
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => game.resize(), 100);
});

// Stop iOS pinch-zoom and double-tap zoom from fighting the board.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js');
}

// Handy from the Safari Web Inspector, and used by the browser smoke test.
window.jankyCrush = game;
