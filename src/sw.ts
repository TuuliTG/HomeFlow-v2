/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

import { notificationPath, openApp, parsePushPayload } from '@/lib/pushNotification';

declare const self: ServiceWorkerGlobalScope;

// The same offline app shell the generated worker had: precache the build and serve index.html for
// navigations.
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
      data: notification.url,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(notificationPath(event.notification.data), self.location.origin).href;
  event.waitUntil(openApp(self.clients, url));
});

function readJson(data: PushMessageData | null): unknown {
  try {
    return data?.json();
  } catch {
    return undefined;
  }
}
