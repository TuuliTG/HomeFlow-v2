/**
 * What a push message carries (ADR 0005): who added which task, and where tapping it leads.
 * The service worker shows it; the notify-household Edge Function sends it. Checked by hand rather
 * than with Zod to keep the service worker small (ADR 0005).
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

// Only same-origin paths: a push message must never send the user to another site. Resolving the
// path against a placeholder origin catches every trick the URL parser allows (`//`, `\`, tabs…).
const placeholderOrigin = 'https://app.invalid';
function isAppPath(value: unknown): value is string {
  return (
    isText(value, 1, 200) &&
    value.startsWith('/') &&
    new URL(value, placeholderOrigin).origin === placeholderOrigin
  );
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

/** The parts of the service worker's `Clients` API that opening the app needs. */
interface AppWindow {
  url: string;
  focused: boolean;
  focus: () => Promise<unknown>;
  navigate: (url: string) => Promise<unknown>;
}
interface AppClients<W extends AppWindow> {
  matchAll: (options: { type: 'window'; includeUncontrolled: boolean }) => Promise<readonly W[]>;
  openWindow: (url: string) => Promise<unknown>;
}

/**
 * Shows `url` after a notification is tapped: reuses an open HomeFlow window (the focused one if
 * any) or opens a new one. A window the service worker doesn't control can't be navigated, so then
 * a new window opens instead.
 */
export async function openApp<W extends AppWindow>(clients: AppClients<W>, url: string) {
  const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  const appWindow = windows.find((client) => client.focused) ?? windows[0];
  if (!appWindow) {
    await clients.openWindow(url);
    return;
  }
  await appWindow.focus();
  if (appWindow.url === url) return;
  try {
    await appWindow.navigate(url);
  } catch {
    await clients.openWindow(url);
  }
}
