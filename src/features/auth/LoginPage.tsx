import { Navigate } from 'react-router';

import { paths } from '@/app/paths';
import { PageHeader } from '@/components/ui/PageHeader';
import { DisplayNameForm } from '@/features/auth/DisplayNameForm';
import { PasswordForm } from '@/features/auth/PasswordForm';
import { useOwnProfile } from '@/features/auth/useOwnProfile';
import { useAuth } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

/**
 * Log in with email and password (or create an account). A first-time user then picks a display name;
 * anyone who already has one is sent on to the app.
 */
export function LoginPage() {
  const { status, user } = useAuth();
  const t = useMessages();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
      <PageHeader
        eyebrow="HomeFlow"
        title={user ? t.auth.welcomeTitle : t.auth.logInTitle}
        description={user ? t.auth.welcomeDescription : t.auth.logInDescription}
      />
      {status === 'ready' && (user ? <ProfileStep userId={user.id} /> : <PasswordForm />)}
    </main>
  );
}

function ProfileStep({ userId }: { userId: string }) {
  const profile = useOwnProfile(userId);
  const t = useMessages();

  if (profile.isPending) return <p className="text-sm text-slate-600">{t.common.loading}</p>;
  if (profile.data) return <Navigate to={paths.tasks} replace />;
  return <DisplayNameForm userId={userId} />;
}
