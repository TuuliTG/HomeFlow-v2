import { useRegisterSW } from 'virtual:pwa-register/react';

import { checkForUpdatesWhileOpen } from '@/lib/appUpdate';
import { useMessages } from '@/lib/i18n/i18n';

/**
 * Registers the service worker and, once a new version of HomeFlow has downloaded, offers to reload
 * into it. Shown on every screen, including the login.
 */
export function UpdateBanner() {
  const t = useMessages().app.update;
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) checkForUpdatesWhileOpen(registration);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-0 top-[calc(0.75rem+env(safe-area-inset-top))] z-30 flex justify-center px-4">
      <div
        role="status"
        className="flex max-w-sm items-center gap-3 rounded-full bg-slate-900 py-2 pr-2 pl-4 text-sm text-white shadow-lg"
      >
        <p className="min-w-0">{t.available}</p>
        <button
          type="button"
          onClick={() => void updateServiceWorker()}
          className="shrink-0 rounded-full bg-white px-3 py-1 font-medium text-slate-900 hover:bg-indigo-100"
        >
          {t.reload}
        </button>
      </div>
    </div>
  );
}
