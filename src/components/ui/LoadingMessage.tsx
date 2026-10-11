import { useMessages } from '@/lib/i18n/i18n';

/** Placeholder while data a screen depends on is loading. */
export function LoadingMessage() {
  const t = useMessages();
  return (
    <p role="status" className="p-6 text-center text-sm text-slate-600">
      {t.common.loading}
    </p>
  );
}
