const CACHE_NAME = 'matix-v2.1.0';

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

// ----------------------------------------------------
// Web Push Notification Event (Phone & Desktop Push)
// ----------------------------------------------------
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || 'MATIX — إشعار جديد';
  const options = {
    body: data.body || 'لديك تحديث أو طلب مواد جديد في منصة MATIX',
    icon: data.icon || './assets/logo.png',
    badge: data.badge || './assets/logo.png',
    tag: data.tag || `matix-${Date.now()}`,
    data: data.data || { url: './index.html#/requests' },
    vibrate: data.vibrate || [200, 100, 200, 100, 300],
    renotify: true,
    requireInteraction: true,
    actions: [
      { action: 'open', title: 'عرض التفاصيل 🔍' },
      { action: 'close', title: 'إغلاق ✕' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ----------------------------------------------------
// Notification Click Event (Open App & Navigate to Page)
// ----------------------------------------------------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const targetPath = event.notification.data?.url || './index.html#/requests';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it and navigate
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          client.navigate(targetPath);
          return;
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetPath);
      }
    })
  );
});
