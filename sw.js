/* Ghost Match — network-first service worker (latest when online, cached fallback offline) */
const CACHE = 'bogeyman-matches-v16';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // Cross-origin live data (golfcourseapi, the published Sheet CSV) always hits the network.
  if (new URL(req.url).origin !== self.location.origin) return;
  // Network-first for same-origin shell: online you always get the latest bundle
  // (deploys show on the next open, no double-reopen). Offline, fall back to cache,
  // and serve the cached page for navigations so the app still launches at the course.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});
