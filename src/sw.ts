/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

import { findAppWindow, notificationPath, parsePushPayload } from '@/lib/pushNotification';

declare const self: ServiceWorkerGlobalScope;

// Offline app shell, as before ADR 0014: precache the build and serve index.html for navigations.
// New versions take over straight away (registerType: 'autoUpdate').
void self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

self.addEventListener('push', (event) => {
  const notification = parsePushPayload(readJson(event.data));
  event.waitUntil(
    self.registration.showNotification(notification.title, {
      body: notification.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      data: notification.url,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(notificationPath(event.notification.data), self.location.origin).href;
  event.waitUntil(openApp(url));
});

function readJson(data: PushMessageData | null): unknown {
  try {
    return data?.json();
  } catch {
    return undefined;
  }
}

async function openApp(url: string) {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const appWindow = findAppWindow(windows, self.location.origin);
  if (!appWindow) {
    await self.clients.openWindow(url);
    return;
  }
  const focused = await appWindow.focus();
  if (focused.url !== url) await focused.navigate(url);
}
