/**
 * The browser's push APIs, kept behind this module so the rest of the feature (and its tests) don't
 * touch `navigator` directly.
 */

export type PushSupport = 'supported' | 'needs-home-screen' | 'unsupported';

export interface DeviceSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** How long turning notifications on waits for a freshly installed service worker. */
const SERVICE_WORKER_WAIT_MS = 10_000;

/**
 * Push needs a service worker and the Push API. iPhones (iOS 16.4+) only offer it to apps opened
 * from the Home Screen; an iPhone that is already there but lacks it is too old.
 */
export function pushSupport(): PushSupport {
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
    return 'supported';
  }
  const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) || isIpadOs();
  return isIos && !isHomeScreenApp() ? 'needs-home-screen' : 'unsupported';
}

// iPadOS Safari reports itself as a Mac; touch support gives it away.
function isIpadOs() {
  return navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1;
}

function isHomeScreenApp() {
  return window.matchMedia('(display-mode: standalone)').matches;
}

export function permission(): NotificationPermission {
  return Notification.permission;
}

/** Shows the browser's permission prompt. Call it straight from a tap: Safari requires that. */
export function requestPermission(): Promise<NotificationPermission> {
  return Notification.requestPermission();
}

// getRegistration() rather than `ready`: `ready` never settles when no service worker is installed,
// which would hang logging out.
async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

/**
 * This device's subscription if it was made with `vapidPublicKey`. One made with another key can't
 * receive our notifications any more, so it is dropped.
 */
export async function getDeviceSubscription(
  vapidPublicKey: string,
): Promise<DeviceSubscription | null> {
  const subscription = await currentSubscription();
  if (!subscription) return null;
  if (!sameKey(subscription.options.applicationServerKey, base64UrlToBytes(vapidPublicKey))) {
    await subscription.unsubscribe();
    return null;
  }
  return toDeviceSubscription(subscription);
}

/** The endpoint of this device's subscription, whatever key it was made with. */
export async function getDeviceEndpoint(): Promise<string | null> {
  return (await currentSubscription())?.endpoint ?? null;
}

/** Subscribes this device. Needs notification permission already granted. */
export async function subscribeDevice(vapidPublicKey: string): Promise<DeviceSubscription> {
  const registration = await activeRegistration();
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToBytes(vapidPublicKey),
  });
  return toDeviceSubscription(subscription);
}

/** Unsubscribes this device, if it is subscribed. */
export async function unsubscribeDevice(): Promise<void> {
  await (await currentSubscription())?.unsubscribe();
}

// Subscribing needs an active worker; on a first visit it may still be installing.
function activeRegistration(): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_resolve, reject) => {
      setTimeout(() => {
        reject(new Error('HomeFlow has no service worker yet; reload and try again'));
      }, SERVICE_WORKER_WAIT_MS);
    }),
  ]);
}

function toDeviceSubscription(subscription: PushSubscription): DeviceSubscription {
  const { endpoint, keys } = subscription.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) {
    throw new Error('The browser returned an incomplete push subscription');
  }
  return { endpoint, p256dh: keys.p256dh, auth: keys.auth };
}

function sameKey(serverKey: ArrayBuffer | null, expected: Uint8Array): boolean {
  if (!serverKey) return false;
  const actual = new Uint8Array(serverKey);
  return actual.length === expected.length && actual.every((byte, i) => byte === expected[i]);
}

function base64UrlToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
