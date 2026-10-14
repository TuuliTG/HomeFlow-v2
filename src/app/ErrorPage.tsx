import { useEffect } from 'react';
import { useRouteError } from 'react-router';

import { PageHeader } from '@/components/ui/PageHeader';
import { useMessages } from '@/lib/i18n/i18n';
import { reportError } from '@/lib/monitoring';

/** Shown instead of a screen that crashed while rendering or loading; the crash is reported to Sentry. */
export function ErrorPage() {
  const error = useRouteError();
  const t = useMessages().app.error;

  useEffect(() => {
    void reportError(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-6">
      <PageHeader title={t.title} description={t.description} />
      <button
        type="button"
        onClick={() => {
          window.location.reload();
        }}
        className="bg-brand-600 hover:bg-brand-900 rounded-lg px-4 py-2.5 font-semibold text-white"
      >
        {t.reload}
      </button>
    </main>
  );
}
