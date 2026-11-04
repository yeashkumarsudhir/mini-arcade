/**
 * sw.js
 * Parlour Arcade Service Worker
 * Resilient offline pre-caching, Stale-While-Revalidate asset delivery, and instant activation
 */

const CACHE_NAME = 'parlour-cabinet-cache-v5';

const PRECACHE_MANIFEST = [
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
  './js/analytics.js',
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
  './js/core/i18n.js',
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
      for (const asset of PRECACHE_MANIFEST) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn(`[ServiceWorker] Optional precache skipped for: ${asset}`, err);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log(`[ServiceWorker] Evicting outdated cache layer: ${key}`);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  // Navigation requests: fetch network first, fallback to offline.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => {
        return caches.match('./offline.html', { ignoreSearch: true });
      })
    );
    return;
  }

  // Static Assets: Stale-While-Revalidate strategy
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cachedResponse) => {
      const fetchPromise = fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});