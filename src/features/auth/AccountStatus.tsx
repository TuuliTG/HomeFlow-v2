import { useOwnProfile } from '@/features/auth/useOwnProfile';
import { useAuth, useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

/** Shows who is logged in, with a log-out button. */
export function AccountStatus() {
  const user = useLoggedInUser();
  const { logOut } = useAuth();
  const profile = useOwnProfile(user.id);
  const t = useMessages();

  return (
    <div className="flex min-w-0 items-center gap-3 text-sm">
      {!profile.isPending && (
        <span className="text-ink truncate font-medium">
          {profile.data ? t.auth.hello(profile.data.displayName) : t.auth.loggedInAs(user.email)}
        </span>
      )}
      <button
        type="button"
        onClick={() => void logOut()}
        className="border-line-strong text-ink hover:bg-page shrink-0 rounded-lg border px-3 py-1.5 font-medium"
      >
        {t.common.logOut}
      </button>
    </div>
  );
}
