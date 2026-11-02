import { SavingCheckbox } from '@/components/ui/SavingCheckbox';
import { type NotificationKind, notificationKinds } from '@/features/notifications/preferences';
import { useNotificationPreferences } from '@/features/notifications/useNotificationPreferences';
import { useMessages } from '@/lib/i18n/i18n';

interface NotificationChoicesProps {
  /** Children have no News, so they aren't told when someone finishes a task (ADR 0008). */
  isChild: boolean;
}

/** Which kinds of notification the user gets, on all their devices (ADR 0005). */
export function NotificationChoices({ isChild }: NotificationChoicesProps) {
  const { preferences, setPreference, isSaving, failed } = useNotificationPreferences();
  const t = useMessages().notifications.choices;
  const kinds = notificationKinds.filter((kind) => !isChild || kind !== 'taskCompleted');

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-ink mb-1 text-sm font-semibold">{t.legend}</legend>
      {preferences &&
        kinds.map((kind: NotificationKind) => (
          <SavingCheckbox
            key={kind}
            label={t.kinds[kind]}
            checked={preferences[kind]}
            disabled={isSaving}
            onChange={(wanted) => setPreference(kind, wanted)}
          />
        ))}
      <p className="text-ink-muted text-xs">{t.allDevices}</p>
      {failed && (
        <p role="alert" className="text-danger-700 text-sm">
          {t.saveFailed}
        </p>
      )}
    </fieldset>
  );
}
