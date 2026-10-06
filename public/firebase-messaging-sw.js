/* eslint-disable no-undef */
// Service Worker untuk Firebase Cloud Messaging & Web Push WayaheDigital

// 1. Install & Activate Lifecycle
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 2. Handle Push Notifications (Raw Web Push & FCM HTTP v1)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (_) {
    payload = {
      notification: {
        title: 'WayaheDigital Alert',
        body: event.data.text(),
      },
    };
  }

  const notificationData = payload.notification || payload.data || {};
  const dataPayload = payload.data || {};

  const title = notificationData.title || dataPayload.title || 'Pesanan Baru Wayahe';
  const body = notificationData.body || dataPayload.body || 'Ada update pesanan baru di toko Anda.';
  const icon = notificationData.icon || dataPayload.icon || '/icons/icon-192x192.png';
  const badge = notificationData.badge || dataPayload.badge || '/icons/icon-192x192.png';
  const targetUrl = dataPayload.url || notificationData.click_action || '/owner';
  const tag = notificationData.tag || dataPayload.tag || `wayahe-${Date.now()}`;

  const options = {
    body,
    icon,
    badge,
    tag,
    data: {
      url: targetUrl,
      ...(payload.data || {}),
    },
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 300],
    actions: [
      { action: 'open_order', title: '🔍 Buka Pesanan' },
      { action: 'close', title: 'Tutup' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 3. Handle Notification Click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/owner';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Jika tab admin sudah terbuka, fokuskan tab tersebut dan arahkan URL
      for (const client of windowClients) {
        if (client.url && 'focus' in client) {
          client.focus();
          if (client.navigate) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      // Jika belum ada window/tab terbuka, buka window baru
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
