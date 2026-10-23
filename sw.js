// Offline support: serve the app shell from cache, refresh it in the
// background. Bump VERSION whenever the file list changes.
const VERSION = 'jc-v5';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './fonts/chakra-petch.css',
  './fonts/chakra-petch-latin-500-normal.woff2',
  './fonts/chakra-petch-latin-600-normal.woff2',
  './fonts/chakra-petch-latin-700-normal.woff2',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './src/main.js',
  './src/game.js',
  './src/levels.js',
  './src/rng.js',
  './src/engine/board.js',
  './src/render/renderer.js',
  './src/render/sprites.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
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
      const fresh = fetch(e.request)
        .then((res) => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});
