export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Asks the browser to look for a new service worker when the app comes back to the foreground, and
 * hourly while it stays open. A Home Screen app on iOS is usually resumed rather than reopened, so
 * the browser's own check at page load rarely runs. Returns a function that stops the checks.
 */
export function checkForUpdatesWhileOpen(registration: { update: () => Promise<unknown> }) {
  const check = () => {
    // A failed check (offline, server down) just waits for the next one.
    registration.update().catch(() => undefined);
  };
  const checkIfVisible = () => {
    if (document.visibilityState === 'visible') check();
  };
  document.addEventListener('visibilitychange', checkIfVisible);
  const interval = setInterval(check, UPDATE_CHECK_INTERVAL_MS);
  return () => {
    document.removeEventListener('visibilitychange', checkIfVisible);
    clearInterval(interval);
  };
}

interface NewVersion {
  registration: Pick<ServiceWorkerRegistration, 'waiting'> | undefined;
  serviceWorker: Pick<ServiceWorkerContainer, 'addEventListener'>;
  /** Asks the waiting service worker to take over. */
  skipWaiting: () => Promise<void>;
}

/**
 * Reloads the page into the waiting version once it takes control. vite-plugin-pwa reloads only when
 * the page had a service worker at load, so a page from the very first install would stay on the old
 * code. If another window already let the new version in, nothing is waiting and a reload is enough.
 */
export function reloadIntoNewVersion({ registration, serviceWorker, skipWaiting }: NewVersion) {
  if (!registration?.waiting) {
    location.reload();
    return;
  }
  serviceWorker.addEventListener(
    'controllerchange',
    () => {
      location.reload();
    },
    { once: true },
  );
  void skipWaiting();
}
