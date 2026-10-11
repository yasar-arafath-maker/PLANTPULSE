const CACHE_NAME = 'plantpulse-v5';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './register.html',
  './dashboard.html',
  './plant-detail.html',
  './add-plant.html',
  './shop.html',
  './my-orders.html',
  './admin.html',
  './simulator.html',
  './css/style.css',
  './js/config.js',
  './js/auth.js',
  './js/dashboard.js',
  './js/plant-detail.js',
  './js/add-plant.js',
  './js/shop.js',
  './js/my-orders.js',
  './js/admin.js',
  './js/simulator.js',
  './assets/plantpulse-logo.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './manifest.json'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets v5');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up old caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Network-First Strategy to prevent stale cache bugs
self.addEventListener('fetch', (event) => {
  // Do not intercept or cache API endpoints - always network
  if (event.request.url.includes('/api/')) {
    return;
  }

  // Network-First for HTML, JS and CSS: fresh code always, cache fallback when offline
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
            return caches.match('./dashboard.html') || caches.match('./index.html');
          }
        });
      })
  );
});
