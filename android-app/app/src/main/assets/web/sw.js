const CACHE_NAME = 'plantpulse-v1';
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
  './js/auth.js',
  './js/dashboard.js',
  './js/plant-detail.js',
  './js/add-plant.js',
  './js/shop.js',
  './js/my-orders.js',
  './js/admin.js',
  './js/simulator.js',
  './manifest.json'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
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

// Fetch Event
self.addEventListener('fetch', (event) => {
  // Do not cache API endpoints - always fetch fresh data from server
  if (event.request.url.includes('/api/')) {
    return event.respondWith(fetch(event.request));
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      });
    }).catch(() => {
      // Offline fallback
      if (event.request.headers.get('accept').includes('text/html')) {
        return caches.match('./index.html');
      }
    })
  );
});
