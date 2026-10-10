import { Link, useLocation, useNavigate } from 'react-router';

/**
 * Goes back to the page the user came from. When the form was opened directly (no earlier page in
 * the app, e.g. a bookmark or reload), it goes to `fallback` instead.
 */
export function CancelLink({ fallback }: { fallback: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const cameFromApp = location.key !== 'default';

  return (
    <Link
      to={fallback}
      onClick={(event) => {
        if (!cameFromApp) return;
        event.preventDefault();
        void navigate(-1);
      }}
      className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-center font-semibold text-slate-700 hover:bg-slate-100"
    >
      Cancel
    </Link>
  );
}
