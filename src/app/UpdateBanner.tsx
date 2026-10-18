import { useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

import { checkForUpdatesWhileOpen, reloadIntoNewVersion } from '@/lib/appUpdate';
import { useMessages } from '@/lib/i18n/i18n';

/**
 * Registers the service worker and, once a new version of HomeFlow has downloaded, offers to reload
 * into it. Shown on every screen, including the login. The live region is always present so screen
 * readers announce the offer.
 */
export function UpdateBanner() {
  const t = useMessages().app.update;
  const registration = useRef<ServiceWorkerRegistration>(undefined);
  const [dismissed, setDismissed] = useState(false);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registered) {
      registration.current = registered;
      // The banner lives as long as the page, so the checks never need stopping.
      if (registered) checkForUpdatesWhileOpen(registered);
    },
  });
  const visible = needRefresh && !dismissed;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(0.75rem+env(safe-area-inset-top))] z-30 flex justify-center px-4">
      <div
        role="status"
        className={[
          'flex max-w-sm items-center gap-2 rounded-2xl bg-slate-900 py-1 pr-1 pl-4 text-sm text-white shadow-lg',
          visible ? 'pointer-events-auto' : 'sr-only',
        ].join(' ')}
      >
        {visible && (
          <>
            <p className="min-w-0 py-2">{t.available}</p>
            <button
              type="button"
              onClick={() => {
                reloadIntoNewVersion({
                  registration: registration.current,
                  serviceWorker: navigator.serviceWorker,
                  skipWaiting: updateServiceWorker,
                });
              }}
              className="hover:bg-brand-50 focus-visible:outline-brand-600 min-h-11 shrink-0 rounded-xl bg-white px-3 font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {t.reload}
            </button>
            <button
              type="button"
              onClick={() => {
                setDismissed(true);
              }}
              className="focus-visible:outline-brand-600 min-h-11 min-w-11 shrink-0 rounded-xl text-slate-300 hover:bg-slate-700 hover:text-white focus-visible:outline-2"
            >
              <span aria-hidden="true">✕</span>
              <span className="sr-only">{t.later}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
