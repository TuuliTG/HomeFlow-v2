import { type SyntheticEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { paths } from '@/app/paths';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/features/auth/authContext';

/** Mock log-in: asks only for a name, with no password or backend. */
export function LoginPage() {
  const { logIn } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [showError, setShowError] = useState(false);

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    if (!name.trim()) {
      setShowError(true);
      return;
    }
    logIn(name);
    void navigate(paths.tasks);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
      <PageHeader
        eyebrow="HomeFlow"
        title="Log in to HomeFlow"
        description="Share household tasks fairly with your family."
      />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Your name
          <input
            type="text"
            name="name"
            autoComplete="given-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setShowError(false);
            }}
            aria-invalid={showError}
            aria-describedby={showError ? 'name-error' : undefined}
            className="focus:border-brand-600 focus:ring-brand-600 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-normal text-slate-900 focus:ring-1 focus:outline-none"
          />
        </label>
        {showError && (
          <p id="name-error" role="alert" className="text-sm text-red-700">
            Enter your name to log in.
          </p>
        )}
        <button
          type="submit"
          className="bg-brand-600 hover:bg-brand-900 rounded-lg px-4 py-2.5 font-semibold text-white"
        >
          Log in
        </button>
        <p className="text-xs text-slate-500">
          Demo only: no password needed, and your name stays in this browser.
        </p>
      </form>
      <Link
        to={paths.tasks}
        className="text-brand-600 mt-6 text-center text-sm font-medium underline"
      >
        Continue without logging in
      </Link>
    </main>
  );
}
