import { useId, useState } from 'react';
import { Navigate } from 'react-router';

import { paths } from '@/app/paths';
import { PageHeader } from '@/components/ui/PageHeader';
import { ChildCodeForm } from '@/features/auth/ChildCodeForm';
import { DisplayNameForm } from '@/features/auth/DisplayNameForm';
import { PasswordForm } from '@/features/auth/PasswordForm';
import { useOwnProfile } from '@/features/auth/useOwnProfile';
import { useAuth } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

/**
 * Log in with email and password (or create an account), or as a child with a sign-in code. A first-time
 * user then picks a display name; anyone who already has one is sent on to the app.
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
      {status === 'ready' && (user ? <ProfileStep userId={user.id} /> : <LoginForms />)}
    </main>
  );
}

function LoginForms() {
  const [withChildCode, setWithChildCode] = useState(false);
  const hintId = useId();
  const t = useMessages();

  if (withChildCode) {
    return (
      <ChildCodeForm
        onBack={() => {
          setWithChildCode(false);
        }}
      />
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <PasswordForm />
      <div className="border-line flex flex-col gap-2 border-t pt-6">
        <button
          type="button"
          aria-describedby={hintId}
          onClick={() => {
            setWithChildCode(true);
          }}
          className="border-line-strong text-ink hover:bg-surface rounded-xl border px-4 py-2.5 font-medium"
        >
          {t.auth.childCode.open}
        </button>
        <p id={hintId} className="text-ink-muted text-center text-sm">
          {t.auth.childCode.openHint}
        </p>
      </div>
    </div>
  );
}

function ProfileStep({ userId }: { userId: string }) {
  const profile = useOwnProfile(userId);
  const t = useMessages();

  if (profile.isPending) return <p className="text-ink-muted text-sm">{t.common.loading}</p>;
  if (profile.data) return <Navigate to={paths.tasks} replace />;
  return <DisplayNameForm userId={userId} />;
}
