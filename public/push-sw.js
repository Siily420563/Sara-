const CACHE_NAME = 'sara-static-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/default-avatar.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/manifest.json'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS).catch(function(err) {
        console.warn('Initial cache addAll warning:', err);
      });
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  if (!event.request || event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Bypass API and WebSocket routes for direct network
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/live')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(function(networkResponse) {
        // Cache successful responses for offline access
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(function() {
        return caches.match(event.request).then(function(cachedResponse) {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback to root index.html for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Offline content unavailable', { status: 503, statusText: 'Offline' });
        });
      })
  );
});

// Background Sync Handler (One-off Background Sync)
self.addEventListener('sync', function(event) {
  if (event.tag === 'sara-sync-reminders' || event.tag === 'sara-background-sync') {
    event.waitUntil(
      fetch('/api/ping', { method: 'POST' }).catch(function() {})
    );
  }
});

// Periodic Background Sync Handler (e.g. Daily Greeting Check / Background Check)
self.addEventListener('periodicsync', function(event) {
  if (event.tag === 'sara-daily-sync' || event.tag === 'sara-periodic-reminder-check') {
    event.waitUntil(
      fetch('/api/ping', { method: 'POST' }).catch(function() {})
    );
  }
});

self.addEventListener('push', function(event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch(e) {
    data = { body: event.data ? event.data.text() : 'You have a new reminder!' };
  }
  
  const title = data.title || '🚨 SARA Reminder Alert';
  const options = {
    body: data.body || 'You have a scheduled reminder from SARA.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [300, 150, 300, 150, 450],
    data: {
      url: data.url || '/',
      reminderText: data.body || '',
      timestamp: Date.now()
    },
    requireInteraction: true,
    tag: data.tag || ('sara-reminder-' + Date.now()),
    actions: [
      { action: 'open', title: 'Open & Listen' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }

  const notificationData = event.notification.data || {};
  const urlToOpen = notificationData.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url && 'focus' in client) {
          // Notify the open client to trigger voice announcement
          client.postMessage({
            type: 'REMINDER_PUSH_CLICKED',
            text: notificationData.reminderText || ''
          });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
