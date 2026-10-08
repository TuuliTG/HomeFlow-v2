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

/** Push needs a service worker and the Push API; iPhones only offer it to home-screen apps. */
export function pushSupport(): PushSupport {
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
    return 'supported';
  }
  const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) || isIpadOs();
  return isIos ? 'needs-home-screen' : 'unsupported';
}

// iPadOS Safari reports itself as a Mac; touch support gives it away.
function isIpadOs() {
  return navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1;
}

export function permission(): NotificationPermission {
  return Notification.permission;
}

// getRegistration() rather than `ready`: `ready` never settles when no service worker is installed,
// which would hang logging out.
async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

/** This device's push subscription, if notifications are on. */
export async function getDeviceSubscription(): Promise<DeviceSubscription | null> {
  const subscription = await currentSubscription();
  return subscription ? toDeviceSubscription(subscription) : null;
}

/**
 * Asks for permission (must run from a tap) and subscribes this device. Returns null if the user
 * doesn't allow notifications.
 */
export async function subscribeDevice(vapidPublicKey: string): Promise<DeviceSubscription | null> {
  if ((await Notification.requestPermission()) !== 'granted') return null;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) throw new Error('HomeFlow has no service worker yet; reload and try again');
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToBytes(vapidPublicKey),
  });
  return toDeviceSubscription(subscription);
}

/** Unsubscribes this device; returns the endpoint it had, if any. */
export async function unsubscribeDevice(): Promise<string | null> {
  const subscription = await currentSubscription();
  if (!subscription) return null;
  await subscription.unsubscribe();
  return subscription.endpoint;
}

function toDeviceSubscription(subscription: PushSubscription): DeviceSubscription {
  const { endpoint, keys } = subscription.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) {
    throw new Error('The browser returned an incomplete push subscription');
  }
  return { endpoint, p256dh: keys.p256dh, auth: keys.auth };
}

function base64UrlToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
