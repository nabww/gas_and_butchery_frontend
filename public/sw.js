// TeziPOS service worker — Week 0 skeleton.
// Handles offline asset caching now. The actual sync-queue logic (queuing
// sales/points/stock writes made while offline and pushing them once
// connectivity returns) is Phase 1 work — see build plan Section 4.

// Bump this on any change to the caching strategy below -- the activate
// handler purges any cache whose name doesn't match, which is what
// clears out a stale shell after a deploy.
const CACHE_NAME = 'tezipos-shell-v2';

self.addEventListener('install', (event) => {
  // Nothing to precache -- index.html and hashed assets are cached
  // on-demand as they're actually requested (see fetch handler below).
  // Precaching '/' and '/index.html' here used to mean a device that
  // installed the service worker once would keep serving that exact
  // index.html forever, even after a new deploy shipped a new one with
  // different hashed asset filenames -- causing 404s on old asset names
  // the new deploy no longer contains (blank white screen).
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
  // service worker cache.
  if (event.request.url.includes('/api/')) return;

  // Navigation requests (the HTML shell itself) always go network-first.
  // This is the file that names every other hashed asset, so serving a
  // stale cached copy while online is what causes "index.html asks for
  // an asset the current deploy doesn't have" 404s after a new deploy.
  // Offline still falls back to whatever was last cached, preserving the
  // offline-first till experience.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Everything else (JS/CSS/images) is content-hashed by Vite -- safe to
  // cache-first since a changed file gets a new filename automatically.
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return res;
        }),
    ),
  );
});
