// TeziPOS service worker — Week 0 skeleton.
// Handles offline asset caching now. The actual sync-queue logic (queuing
// sales/points/stock writes made while offline and pushing them once
// connectivity returns) is Phase 1 work — see build plan Section 4.

const CACHE_NAME = 'tezipos-shell-v1';
const APP_SHELL = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // API calls (/api/*) are never cache-first -- they go through the
  // IndexedDB-backed sync queue (see lib/db/syncQueue.js), not the
  // service worker cache. Only static app-shell assets are cached here.
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
