/**
 * firebase-messaging-sw.js
 * Service worker for Firebase Cloud Messaging background push notifications.
 * This file MUST be in the public/ folder (served at root /).
 *
 * Firebase config is injected from Vite env vars at build time.
 */

/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp(__FIREBASE_MESSAGING_SW_CONFIG__);

const messaging = firebase.messaging();

/**
 * Handle background messages (when app is not in foreground).
 * Shows a system notification with crisis details.
 */
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw] Background message:', payload);

  const { title, body } = payload.notification || {};
  const data = payload.data || {};

  const notificationTitle = title || '🚨 SilentGuard Alert';
  const notificationOptions = {
    body: body || `${data.className || 'Crisis'} detected in Room ${data.roomId || '?'}`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'silentguard-crisis',
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 100, 300, 100, 300],
    data: data,
    actions: [
      { action: 'view', title: 'View Details' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

/**
 * Handle notification click — open the app.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if available
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      return clients.openWindow('/');
    })
  );
});
