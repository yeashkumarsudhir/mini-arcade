// sw.js: makes the site work offline.
// Pages: try the network first, fall back to the saved copy. Files: saved copy first, refreshed in the background.
// Change CACHE_NAME whenever you change a file, or people keep seeing the old version.

const CACHE_NAME = 'mini-arcade-v6';

const FILES = [
  './',
  './index.html',
  './offline.html',
  './style.css',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-maskable.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './js/app.js',
  './js/stats.js',
  './js/fx.js',
  './js/core/bus.js',
  './js/core/store.js',
  './js/core/scheduler.js',
  './js/core/loop.js',
  './js/core/input.js',
  './js/core/ui.js',
  './js/core/router.js',
  './js/core/haptics.js',
  './js/core/storage.js',
  './js/core/savegame.js',
  './js/core/theme.js',
  './js/games/ludo.js',
  './js/games/ludo-rules.js',
  './js/games/ludo-ai.js',
  './js/games/ludo-render.js',
  './js/games/snake.js',
  './js/games/tictactoe.js',
  './js/games/memory.js',
  './js/games/flappy.js',
  './js/games/breakout.js',
  './js/games/twentyfortyeight.js',
  './js/games/minesweeper.js',
  './js/games/mole.js',
  './js/games/connectfour.js',
  './js/games/wordguess.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const file of FILES) {
        try {
          await cache.add(file);
        } catch (err) {
          console.warn('Could not cache', file, err);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => {
        // offline: the saved home page still runs the whole arcade
        return (await caches.match('./index.html')) || caches.match('./offline.html');
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((saved) => {
      const fresh = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => saved);

      return saved || fresh;
    })
  );
});
