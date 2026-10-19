import {
  type NotificationStatus,
  usePushNotifications,
} from '@/features/notifications/usePushNotifications';
import { useMessages } from '@/lib/i18n/i18n';

type ShownStatus = Exclude<NotificationStatus, 'not-set-up'>;

/** Turns push notifications on or off for this device (ADR 0005). Hidden until push is set up. */
export function NotificationSettings() {
  const { status, turnOn, turnOff, isChanging, failed } = usePushNotifications();
  const t = useMessages().notifications;
  const explanations: Record<ShownStatus, string> = t.explanations;

  if (status === 'not-set-up') return null;
  const isOn = status === 'on';
  // One button that stays mounted while toggling, so keyboard and screen-reader focus stays put.
  const canToggle = status === 'on' || status === 'off';

  return (
    <section
      aria-labelledby="notification-settings"
      className="bg-surface shadow-card mt-6 flex flex-col gap-3 rounded-2xl p-4"
    >
      <h2 id="notification-settings" className="text-ink font-semibold">
        {t.heading}
      </h2>
      <p aria-live="polite" className="text-ink-muted text-sm">
        {explanations[status]}
      </p>
      {canToggle && (
        <button
          type="button"
          aria-disabled={isChanging}
          onClick={() => {
            if (isChanging) return;
            if (isOn) turnOff();
            else turnOn();
          }}
          className={[
            'w-fit rounded-lg px-4 py-2 text-sm font-semibold aria-disabled:opacity-60',
            isOn
              ? 'border-line-strong text-ink hover:bg-page border'
              : 'bg-brand-700 hover:bg-brand-900 text-white',
          ].join(' ')}
        >
          {isOn ? t.turnOff : t.turnOn}
        </button>
      )}
      {failed && (
        <p role="alert" className="text-danger-700 text-sm">
          {t.changeFailed}
        </p>
      )}
    </section>
  );
}
