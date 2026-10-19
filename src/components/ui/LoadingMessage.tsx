import { useMessages } from '@/lib/i18n/i18n';

/** Placeholder while data a screen depends on is loading. */
export function LoadingMessage() {
  const t = useMessages();
  return (
    <p role="status" className="text-ink-muted p-6 text-center text-sm">
      {t.common.loading}
    </p>
  );
}
