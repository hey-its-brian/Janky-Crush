// Offline support: serve the app shell from cache, refresh it in the
// background. Bump VERSION whenever the file list changes.
const VERSION = 'jc-v50';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './fonts/hotsprings.css',
  './fonts/lilita-one-latin-400-normal.woff2',
  './fonts/fredoka-latin-500-normal.woff2',
  './fonts/fredoka-latin-600-normal.woff2',
  './fonts/fredoka-latin-700-normal.woff2',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './art/scene/zone1.webp',
  './art/scene/zone2.webp',
  './art/scene/zone3.webp',
  './art/scene/zone4.webp',
  './art/scene/zone5.webp',
  './art/scene/zone6.webp',
  './art/scene/zone7.webp',
  './art/scene/zone8.webp',
  './art/scene/zone9.webp',
  './art/scene/zone10.webp',
  './art/map/balloon.webp',
  './art/map/beachhut.webp',
  './art/map/cloud.webp',
  './art/map/crab.webp',
  './art/map/flower-blue.webp',
  './art/map/flower-orange.webp',
  './art/map/flower-pink.webp',
  './art/map/flower-white.webp',
  './art/map/frog.webp',
  './art/map/hut.webp',
  './art/map/lantern.webp',
  './art/map/monkey.webp',
  './art/map/mountains.webp',
  './art/map/onsen.webp',
  './art/map/palm.webp',
  './art/map/pine.webp',
  './art/map/redpanda.webp',
  './art/map/rocks.webp',
  './art/map/sakura.webp',
  './art/map/teahouse.webp',
  './art/map/torch.webp',
  './art/map/toucan.webp',
  './art/map/tuft-snow.webp',
  './art/map/tuft.webp',
  './art/map/turtle.webp',
  './art/map/yuzutree.webp',
  './art/map/bamboo.webp',
  './art/map/waterfall.webp',
  './art/map/panda.webp',
  './art/map/mushrooms.webp',
  './art/map/lanterntree.webp',
  './art/map/owl.webp',
  './art/map/fireflyjar.webp',
  './art/map/sign.webp',
  './art/map/shell.webp',
  './art/map/starfish.webp',
  './art/map/sailboat.webp',
  './art/map/berrybush.webp',
  './art/map/jamcottage.webp',
  './art/map/reeds.webp',
  './art/map/hedgehog.webp',
  './art/map/stall.webp',
  './art/map/lanternpole.webp',
  './art/map/rockets.webp',
  './art/map/fox.webp',
  './art/map/watermill.webp',
  './art/map/willow.webp',
  './art/map/sacks.webp',
  './art/map/otter.webp',
  './art/map/crystals.webp',
  './art/map/cavehut.webp',
  './art/map/mushrooms.webp',
  './art/map/mole.webp',
  './art/map/ground.png',
  './art/host/idle.webp',
  './art/host/blink.webp',
  './art/host/cheer.webp',
  './art/host/worried.webp',
  './art/pieces/bomb.webp',
  './art/pieces/coco1.webp',
  './art/pieces/coco2.webp',
  './art/pieces/mochi1.webp',
  './art/pieces/mochi2.webp',
  './art/pieces/gummy.webp',
  './art/pieces/jam.webp',
  './art/pieces/duck.webp',
  './art/pieces/pup.webp',
  './art/pieces/cage.webp',
  './art/pieces/portal.webp',
  './art/title/logo.webp',
  './art/title/backdrop.webp',
  './art/pieces/r.png',
  './art/pieces/o.png',
  './art/pieces/y.png',
  './art/pieces/g.png',
  './art/pieces/b.png',
  './art/pieces/p.png',
  './src/main.js',
  './src/game.js',
  './src/levels.js',
  './src/level-tuning.js',
  './src/rng.js',
  './src/save.js',
  './src/settings.js',
  './src/audio/sfx.js',
  './src/audio/music.js',
  './src/audio/haptics.js',
  './src/audio/synth.js',
  './src/engine/board.js',
  './src/engine/level.js',
  './src/engine/turn.js',
  './src/render/renderer.js',
  './src/render/sprites.js',
  './src/art/pieces.js',
  './src/art/icons.js',
  './src/art/map-art.js',
  './src/art/capy.js',
  './src/art/scene.js',
  './src/ui/world.js',
  './src/ui/map.js',
];

self.addEventListener('install', (e) => {
  // 'reload' skips the browser's own cache, which can hold copies up to ten
  // minutes old and would otherwise put the previous version in the new cache.
  const fresh = ASSETS.map((url) => new Request(url, { cache: 'reload' }));
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(fresh)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stale-while-revalidate: instant from cache, updated copy next launch.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(e.request);
      const fresh = fetch(e.request, { cache: 'no-cache' }) // always check with the server
        .then((res) => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});
