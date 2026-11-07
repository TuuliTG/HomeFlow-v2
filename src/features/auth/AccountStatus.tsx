import { ChevronDownIcon } from '@/components/ui/icons';
import { DeviceAccountButtons } from '@/features/auth/DeviceAccountButtons';
import { useAccountSwitch } from '@/features/auth/useAccountSwitch';
import { useOwnProfile } from '@/features/auth/useOwnProfile';
import { useAuth, useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

const logOutStyle =
  'border-line-strong text-ink hover:bg-surface shrink-0 rounded-xl border px-3 py-1.5 font-medium';

/**
 * Shows who is logged in, with a log-out button. With other accounts signed in on this device, both are in
 * a menu under the name, with switching to each of them.
 */
export function AccountStatus() {
  const user = useLoggedInUser();
  const { logOut, otherAccounts } = useAuth();
  const profile = useOwnProfile(user.id);
  const switcher = useAccountSwitch();
  const t = useMessages();

  const name = !profile.isPending && (
    <span className="text-ink truncate font-medium">
      {profile.data ? t.auth.hello(profile.data.displayName) : t.auth.loggedInAs(user.email)}
    </span>
  );
  const logOutButton = (
    <button type="button" onClick={() => void logOut()} className={logOutStyle}>
      {t.common.logOut}
    </button>
  );

  // A failed switch stays in the menu even if it took the last other account off this device.
  if (otherAccounts.length === 0 && !switcher.failure) {
    return (
      <div className="flex min-w-0 items-center gap-3 text-sm">
        {name}
        {logOutButton}
      </div>
    );
  }
  return (
    <details className="group relative min-w-0 text-sm">
      <summary className="hover:bg-surface -my-1 flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-xl px-2 [&::-webkit-details-marker]:hidden">
        {name}
        <ChevronDownIcon className="text-ink-muted size-5 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="bg-surface shadow-card absolute right-0 z-30 mt-2 flex w-56 flex-col gap-2 rounded-2xl p-3">
        <DeviceAccountButtons switcher={switcher} label={t.auth.switchAccount.to} />
        {logOutButton}
      </div>
    </details>
  );
}
