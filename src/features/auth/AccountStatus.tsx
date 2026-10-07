import { useOwnProfile } from '@/features/auth/useOwnProfile';
import { useAuth, useLoggedInUser } from '@/lib/auth';

/** Shows who is logged in, with a log-out button. */
export function AccountStatus() {
  const user = useLoggedInUser();
  const { logOut } = useAuth();
  const profile = useOwnProfile(user.id);

  return (
    <div className="flex min-w-0 items-center gap-3 text-sm">
      {!profile.isPending && (
        <span className="truncate font-medium text-slate-800">
          {profile.data ? `Hello, ${profile.data.displayName}` : `Logged in as ${user.email}`}
        </span>
      )}
      <button
        type="button"
        onClick={() => void logOut()}
        className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
      >
        Log out
      </button>
    </div>
  );
}
