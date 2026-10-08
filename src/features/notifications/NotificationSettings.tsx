import {
  type NotificationStatus,
  usePushNotifications,
} from '@/features/notifications/usePushNotifications';

const explanations: Record<Exclude<NotificationStatus, 'not-set-up'>, string> = {
  unsupported: "This browser can't show notifications from HomeFlow.",
  'needs-home-screen':
    'On iPhone, notifications work once HomeFlow is on your Home Screen: tap Share, then “Add to Home Screen”. Open HomeFlow from there and turn notifications on.',
  checking: 'Checking this device…',
  blocked:
    "Notifications are blocked for HomeFlow. Allow them in your phone's or browser's settings, then come back here.",
  off: 'Get a notification on this device when someone in your household adds a task.',
  on: 'You get a notification on this device when someone in your household adds a task.',
};

const buttonClassName = 'w-fit rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60';

/** Turns push notifications on or off for this device (ADR 0014). Hidden until push is set up. */
export function NotificationSettings() {
  const { status, turnOn, turnOff, isChanging, failed } = usePushNotifications();

  if (status === 'not-set-up') return null;

  return (
    <section
      aria-labelledby="notification-settings"
      className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4"
    >
      <h2 id="notification-settings" className="font-semibold text-slate-900">
        Notifications
      </h2>
      <p className="text-sm text-slate-600">{explanations[status]}</p>
      {status === 'off' && (
        <button
          type="button"
          onClick={turnOn}
          disabled={isChanging}
          className={`bg-brand-600 hover:bg-brand-900 text-white ${buttonClassName}`}
        >
          Turn on notifications
        </button>
      )}
      {status === 'on' && (
        <button
          type="button"
          onClick={turnOff}
          disabled={isChanging}
          className={`border border-slate-300 text-slate-700 hover:bg-slate-100 ${buttonClassName}`}
        >
          Turn off notifications
        </button>
      )}
      {failed && (
        <p role="alert" className="text-sm text-red-700">
          We couldn&apos;t change notifications. Try again.
        </p>
      )}
    </section>
  );
}
