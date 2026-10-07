import { Link, Navigate } from 'react-router';

import { paths } from '@/app/paths';
import { PageHeader } from '@/components/ui/PageHeader';
import { DisplayNameForm } from '@/features/auth/DisplayNameForm';
import { EmailCodeForm } from '@/features/auth/EmailCodeForm';
import { useOwnProfile } from '@/features/auth/useOwnProfile';
import { useAuth } from '@/lib/auth';

/**
 * Log in with an emailed code. A first-time user then picks a display name;
 * anyone who already has one is sent on to the app.
 */
export function LoginPage() {
  const { status, user } = useAuth();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
      <PageHeader
        eyebrow="HomeFlow"
        title={user ? 'Welcome to HomeFlow' : 'Log in to HomeFlow'}
        description={
          user ? 'What should we call you?' : 'Share household tasks fairly with your family.'
        }
      />
      {status === 'ready' && (user ? <ProfileStep userId={user.id} /> : <EmailCodeForm />)}
      {!user && (
        <Link
          to={paths.tasks}
          className="text-brand-600 mt-6 text-center text-sm font-medium underline"
        >
          Continue without logging in
        </Link>
      )}
    </main>
  );
}

function ProfileStep({ userId }: { userId: string }) {
  const profile = useOwnProfile(userId);

  if (profile.isPending) return <p className="text-sm text-slate-600">Loading…</p>;
  if (profile.data) return <Navigate to={paths.tasks} replace />;
  return <DisplayNameForm userId={userId} />;
}
