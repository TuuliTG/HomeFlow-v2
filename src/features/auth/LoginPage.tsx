import { type SyntheticEvent, useState } from 'react';
import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { PageHeader } from '@/components/ui/PageHeader';

/**
 * Placeholder sign-in screen. It has no authentication behind it yet:
 * submitting only tells the user that sign-in is not available.
 */
export function LoginPage() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
      <PageHeader
        eyebrow="HomeFlow"
        title="Sign in to HomeFlow"
        description="Share household tasks fairly with your family."
      />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Email
          <input
            type="email"
            name="email"
            autoComplete="email"
            className="focus:border-brand-600 focus:ring-brand-600 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-normal text-slate-900 focus:ring-1 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="bg-brand-600 hover:bg-brand-900 rounded-lg px-4 py-2.5 font-semibold text-white"
        >
          Sign in
        </button>
        <p role="status" className="min-h-5 text-sm text-slate-600">
          {submitted && "Sign-in isn't available yet."}
        </p>
      </form>
      <Link to={paths.tasks} className="text-brand-600 text-center text-sm font-medium underline">
        Continue without signing in
      </Link>
    </main>
  );
}
