import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { useAuth } from '@/features/auth/authContext';

/** Shows who is logged in with a log-out button, or a log-in link. */
export function AccountStatus() {
  const { user, logOut } = useAuth();

  if (!user) {
    return (
      <Link
        to={paths.login}
        className="bg-brand-600 hover:bg-brand-900 rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
      >
        Log in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="font-medium text-slate-800">Hello, {user.name}</span>
      <button
        type="button"
        onClick={logOut}
        className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
      >
        Log out
      </button>
    </div>
  );
}
