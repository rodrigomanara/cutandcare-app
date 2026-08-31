/* Cut & Care Bookings — service worker.
 *
 * Scope: same-origin static assets only. It never touches `/backend/` (the
 * SugarCRM proxy) or any non-GET request, so auth and API traffic always go
 * straight to the network.
 *
 * Strategy:
 *  - navigations (HTML): network-first, fall back to the cached shell offline;
 *  - other same-origin GETs (js/css/img/vendor): stale-while-revalidate.
 *
 * Bump CACHE_VERSION on any release that changes cached assets.
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `ccb-${CACHE_VERSION}`;

// Minimal shell fetched on install so a cold, offline launch still renders.
const SHELL = [
  '/',
  '/index.html',
  '/login.html',
  '/css/app.css',
  '/manifest.webmanifest',
  '/vendor/fullcalendar/index.global.min.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // SugarCRM / cross-origin
  if (url.pathname.startsWith('/backend/')) return; // API proxy — never cache

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(request)) || (await cache.match('/index.html'));
      }),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((res) => {
          if (res && res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => null);
      return cached || (await network) || Response.error();
    }),
  );
});
