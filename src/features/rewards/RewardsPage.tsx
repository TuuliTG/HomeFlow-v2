import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { GoalCard } from '@/features/rewards/GoalCard';
import type { Goal, GoalScope } from '@/features/rewards/goal';
import { useGoals } from '@/features/rewards/useGoals';
import { useLoggedInUser } from '@/lib/auth';

const emptyClassName =
  'rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600';

const claimedDateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

const sections: Record<GoalScope, { heading: string; empty: string }> = {
  shared: {
    heading: 'Family goals',
    empty: 'No family goals yet. Set one everyone can work towards together, like a trip out.',
  },
  personal: {
    heading: 'Your goals',
    empty: 'Set a goal of your own, like a treat. Only you see it, and only your points count.',
  },
};

export function RewardsPage() {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          eyebrow="Rewards"
          title="Rewards & goals"
          description="Doing shared tasks earns points. Points earned after a goal is set count towards it: everyone's for family goals, yours for your own."
        />
        <Link
          to={paths.newGoal}
          className="bg-brand-600 hover:bg-brand-900 shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-white"
        >
          <span aria-hidden="true">+ </span>New goal
        </Link>
      </div>
      <Goals />
    </>
  );
}

function Goals() {
  const user = useLoggedInUser();
  const goals = useGoals(user.id);

  // A failed refresh keeps showing the goals already loaded.
  if (goals.data === undefined) {
    if (!goals.isError) return <LoadingMessage />;
    return (
      <p role="alert" className="text-sm text-red-700">
        We couldn&apos;t load the goals. Check your connection and reload the page.
      </p>
    );
  }
  const open = goals.data.filter((goal) => goal.claimedAt === null);
  const claimed = goals.data.filter((goal) => goal.claimedAt !== null);
  return (
    <div className="flex flex-col gap-8">
      {(['shared', 'personal'] as const).map((scope) => (
        <GoalSection
          key={scope}
          scope={scope}
          goals={open.filter((goal) => goal.scope === scope)}
          userId={user.id}
        />
      ))}
      {claimed.length > 0 && <ClaimedRewards goals={claimed} />}
    </div>
  );
}

function GoalSection({
  scope,
  goals,
  userId,
}: {
  scope: GoalScope;
  goals: Goal[];
  userId: string;
}) {
  const { heading, empty } = sections[scope];
  const headingId = `${scope}-goals-heading`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-lg font-semibold text-slate-900">
        {heading}
      </h2>
      {goals.length === 0 ? (
        <p className={emptyClassName}>{empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} userId={userId} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ClaimedRewards({ goals }: { goals: Goal[] }) {
  return (
    <section aria-labelledby="claimed-heading" className="flex flex-col gap-3">
      <h2 id="claimed-heading" className="text-lg font-semibold text-slate-900">
        Rewards claimed
      </h2>
      <ul className="flex flex-col divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
        {goals.map((goal) => (
          <li key={goal.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <span className="font-medium text-slate-900">{goal.title}</span>
            <span className="shrink-0 text-slate-500">
              {goal.scope === 'shared' ? 'Family' : 'Yours'} · Claimed{' '}
              {claimedDateFormat.format(new Date(goal.claimedAt ?? ''))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
