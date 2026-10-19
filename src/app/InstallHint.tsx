import { useState } from 'react';

import { useMessages } from '@/lib/i18n/i18n';
import { isHomeScreenApp, isIos } from '@/lib/platform';

const DISMISSED_KEY = 'homeflow:install-hint-dismissed';

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === 'yes';
  } catch {
    // Storage can be unavailable (e.g. private browsing); then the hint just shows again next time.
    return false;
  }
}

function rememberDismissal() {
  try {
    localStorage.setItem(DISMISSED_KEY, 'yes');
  } catch {
    // Nothing to do: the hint still closes for this visit.
  }
}

/**
 * One-time tip for iPhone and iPad users in the browser: adding HomeFlow to the Home Screen makes it
 * open like an app and is required for notifications on iOS.
 */
export function InstallHint() {
  const t = useMessages().app.installHint;
  const [visible, setVisible] = useState(() => isIos() && !isHomeScreenApp() && !wasDismissed());

  if (!visible) return null;

  return (
    <aside
      aria-label={t.title}
      className="bg-brand-50 border-brand-200 text-ink mb-4 flex items-start gap-3 rounded-2xl border p-4 text-sm"
    >
      <div className="flex flex-col gap-1">
        {/* Not a heading: the hint sits above the page's h1 and shouldn't break the heading order. */}
        <p className="text-ink font-semibold">{t.title}</p>
        <p>
          {t.tapShare} <strong>{t.share}</strong>
          {t.then} <strong>{t.addToHomeScreen}</strong>
          {t.benefit}
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          rememberDismissal();
          setVisible(false);
        }}
        className="text-brand-600 hover:bg-brand-100 shrink-0 rounded-lg px-2 py-1 font-medium"
      >
        {t.gotIt}
      </button>
    </aside>
  );
}
