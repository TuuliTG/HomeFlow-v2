/**
 * What a push message carries (ADR 0014): who added which task, and where tapping it leads.
 * The service worker shows it; the notify-household Edge Function sends it. Checked by hand rather
 * than with Zod to keep the service worker small.
 */
export interface PushNotification {
  title: string;
  body: string;
  /** Same-origin path to open when the notification is tapped. */
  url: string;
}

const fallback: PushNotification = {
  title: 'HomeFlow',
  body: 'There is something new in your household.',
  url: '/',
};

function isText(value: unknown, minLength: number, maxLength: number): value is string {
  return typeof value === 'string' && value.length >= minLength && value.length <= maxLength;
}

// Only same-origin paths: a push message must never send the user to another site.
function isAppPath(value: unknown): value is string {
  return isText(value, 1, 200) && value.startsWith('/') && !/^\/[/\\]/.test(value);
}

/** Reads a push message's JSON, falling back to a generic notification if it is missing or invalid. */
export function parsePushPayload(json: unknown): PushNotification {
  if (typeof json !== 'object' || json === null) return fallback;
  const { title, body, url } = json as Record<string, unknown>;
  if (!isText(title, 1, 100) || !isText(body, 0, 300)) return fallback;
  return { title, body, url: isAppPath(url) ? url : fallback.url };
}

/** The path stored on a shown notification, or the task board if it is missing or invalid. */
export function notificationPath(data: unknown): string {
  return isAppPath(data) ? data : fallback.url;
}

/** An open HomeFlow window to reuse when a notification is tapped, instead of opening another. */
export function findAppWindow<T extends { url: string }>(windows: readonly T[], origin: string) {
  return windows.find((window) => new URL(window.url).origin === origin);
}
