const CACHE_NAME = 'matix-v1.0.8';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './js/app.js',
  './js/api.js',
  './js/router.js',
  './js/i18n.js',
  './js/qr-helper.js',
  './js/html5-qrcode.min.js',
  './pages/login.js',
  './pages/scanner.js',
  './js/locales/en.json',
  './js/locales/fr.json',
  './js/locales/ar.json'
];

// Install Event - cache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Some cache assets failed to fetch in offline setup:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Network first for APIs, cache fallback for assets
self.addEventListener('fetch', (event) => {
  // Never cache API requests (keep movement ledger strictly live)
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'OFFLINE',
            message: 'You are currently offline. Please reconnect to perform live ledger operations.'
          }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 503
          }
        );
      })
    );
    return;
  }

  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  const requestUrl = new URL(event.request.url);
  const isAppCode = (
    event.request.mode === 'navigate' ||
    ['script', 'style', 'worker'].includes(event.request.destination) ||
    (
      requestUrl.origin === self.location.origin &&
      /\.(?:html|js|css)$/i.test(requestUrl.pathname)
    )
  );

  // Application code must be network-first so a previous service worker
  // cannot keep serving an old UI after a deployment. Cached copies remain
  // available as an offline fallback.
  if (isAppCode) {
    event.respondWith(
      fetch(event.request)
        .then(async (networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            try {
              const cache = await caches.open(CACHE_NAME);
              await cache.put(event.request, networkResponse.clone());
            } catch {
              // A cache quota/write failure must never hide a valid response.
            }
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(event.request);
          return cachedResponse || new Response('Application shell unavailable while offline.', { status: 503 });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch background update
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
