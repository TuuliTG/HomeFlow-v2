import { useState } from 'react';

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
  const [visible, setVisible] = useState(() => isIos() && !isHomeScreenApp() && !wasDismissed());

  if (!visible) return null;

  return (
    <aside
      aria-label="Add HomeFlow to your Home Screen"
      className="bg-brand-50 mb-4 flex items-start gap-3 rounded-2xl border border-indigo-200 p-4 text-sm text-slate-700"
    >
      <div className="flex flex-col gap-1">
        {/* Not a heading: the hint sits above the page's h1 and shouldn't break the heading order. */}
        <p className="font-semibold text-slate-900">Add HomeFlow to your Home Screen</p>
        <p>
          Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>. HomeFlow then opens
          like an app and can send you notifications.
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          rememberDismissal();
          setVisible(false);
        }}
        className="text-brand-600 shrink-0 rounded-lg px-2 py-1 font-medium hover:bg-indigo-100"
      >
        Got it
      </button>
    </aside>
  );
}
