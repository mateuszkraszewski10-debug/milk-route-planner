const CACHE = 'milk-route-planner-v1.16';
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=1.16',
  './main.js?v=1.16',
  './domain/models.js',
  './domain/capacityPolicy.js',
  './domain/planner.js',
  './storage/vehicleStore.js',
  './ui/planView.js',
  './ui/farmerRows.js',
  './ui/routeOptions.js',
  './manifest.webmanifest',
  './icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('milk-route-planner-') && key !== CACHE)
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request)),
  );
});
