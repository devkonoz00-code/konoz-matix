const CACHE_NAME = 'matix-v2.0.0';

// Install: skip waiting immediately, do NOT pre-cache anything
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Activate: delete ALL old caches aggressively, then claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    })
  );
  self.clients.claim();
});

// Fetch: pass everything straight to the network.
// Only intercept API calls to show a friendly offline message.
self.addEventListener('fetch', (event) => {
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

  // Everything else: go directly to the network, no caching at all
});
