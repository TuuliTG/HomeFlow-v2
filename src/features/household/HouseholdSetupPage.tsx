import { Navigate } from 'react-router';

import { paths } from '@/app/paths';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { CreateHouseholdForm, JoinHouseholdForm } from '@/features/household/HouseholdSetupForms';
import { useOwnHousehold } from '@/features/household/useHousehold';
import { useAuth } from '@/lib/auth';

/** Onboarding step after choosing a name: create a household, or join one with an invite code. */
export function HouseholdSetupPage() {
  const { status, user, logOut } = useAuth();

  if (status === 'loading') return <LoadingMessage />;
  if (!user) return <Navigate to={paths.login} replace />;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
      <PageHeader
        eyebrow="HomeFlow"
        title="Set up your household"
        description="Tasks are shared with everyone in your household."
      />
      <SetupForms userId={user.id} />
      <button
        type="button"
        onClick={() => void logOut()}
        className="text-brand-600 mt-8 text-center text-sm font-medium underline"
      >
        Log out
      </button>
    </main>
  );
}

function SetupForms({ userId }: { userId: string }) {
  const household = useOwnHousehold(userId);

  if (household.isPending) return <LoadingMessage />;
  if (household.data) return <Navigate to={paths.household} replace />;
  if (household.isError) {
    // Offering the forms here would fail for someone who already has a household.
    return (
      <p role="alert" className="text-sm text-red-700">
        We couldn&apos;t check whether you already have a household. Check your connection and
        reload the page.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="create-household" className="flex flex-col gap-3">
        <h2 id="create-household" className="font-semibold text-slate-900">
          Start a new household
        </h2>
        <CreateHouseholdForm userId={userId} />
      </section>
      <section aria-labelledby="join-household" className="flex flex-col gap-3">
        <h2 id="join-household" className="font-semibold text-slate-900">
          Join your family
        </h2>
        <p className="text-sm text-slate-600">
          Has someone already set up HomeFlow? Ask them for your household&apos;s invite code.
        </p>
        <JoinHouseholdForm userId={userId} />
      </section>
    </div>
  );
}
