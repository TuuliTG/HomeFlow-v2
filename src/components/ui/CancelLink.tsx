import { Link, useLocation, useNavigate } from 'react-router';

import { useMessages } from '@/lib/i18n/i18n';

/**
 * Goes back to the page the user came from. When the form was opened directly (no earlier page in
 * the app, e.g. a bookmark or reload), it goes to `fallback` instead.
 */
export function CancelLink({ fallback }: { fallback: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const cameFromApp = location.key !== 'default';
  const t = useMessages();

  return (
    <Link
      to={fallback}
      onClick={(event) => {
        if (!cameFromApp) return;
        event.preventDefault();
        void navigate(-1);
      }}
      className="border-line-strong text-ink hover:bg-surface flex-1 rounded-xl border px-4 py-2.5 text-center font-semibold"
    >
      {t.common.cancel}
    </Link>
  );
}
