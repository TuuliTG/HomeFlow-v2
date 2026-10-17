import { LanguageSettings } from '@/app/LanguageSettings';
import { PageHeader } from '@/components/ui/PageHeader';
import { FamilySettings } from '@/features/household/FamilySettings';
import { NotificationSettings } from '@/features/notifications/NotificationSettings';
import { useMessages } from '@/lib/i18n/i18n';

/** Opened from the gear at the top of the app: the family's codes, notifications and language. */
export function SettingsPage() {
  const t = useMessages().app.settings;
  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <FamilySettings />
      <NotificationSettings />
      <LanguageSettings />
    </>
  );
}
