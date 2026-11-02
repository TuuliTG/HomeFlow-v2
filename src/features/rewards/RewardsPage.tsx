import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { GoalCard } from '@/features/rewards/GoalCard';
import { type Goal, nameOf } from '@/features/rewards/goal';
import { RewardCelebration } from '@/features/rewards/RewardCelebration';
import { useGoals, useGoalSetters } from '@/features/rewards/useGoals';
import { useLoggedInUser } from '@/lib/auth';
import { type Messages, useMessages } from '@/lib/i18n/i18n';

const emptyClassName =
  'rounded-2xl border border-dashed border-line-strong bg-surface p-6 text-sm text-ink-muted';

type Section = keyof Messages['rewards']['sections'];

function sectionOf(goal: Goal, userId: string): Section {
  if (goal.owner === null) return 'shared';
  return goal.owner.id === userId ? 'yours' : 'members';
}

/** Whose a claimed reward was: "Shared", "Yours" or "Ben's". */
function ownerLabel(goal: Goal, userId: string, t: Messages): string {
  const { owner } = t.rewards;
  if (goal.owner === null) return owner.shared;
  return goal.owner.id === userId ? owner.yours : owner.named(nameOf(goal.owner, t));
}

export function RewardsPage() {
  const t = useMessages().rewards;
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader eyebrow={t.eyebrow} title={t.title} />
        <NewGoalLink />
      </div>
      <Goals />
      <RewardCelebration />
    </>
  );
}

/** Only adults set goals (ADR 0007). */
function NewGoalLink() {
  const user = useLoggedInUser();
  const { isAdult } = useGoalSetters(user.id);
  const t = useMessages().rewards;
  if (!isAdult) return null;
  return (
    <Link
      to={paths.newGoal}
      className="bg-brand-700 hover:bg-brand-900 shrink-0 rounded-xl px-3 py-2 text-sm font-bold text-white"
    >
      <span aria-hidden="true">+ </span>
      {t.newGoal}
    </Link>
  );
}

function Goals() {
  const user = useLoggedInUser();
  const goals = useGoals(user.id);
  const { isAdult } = useGoalSetters(user.id);
  const t = useMessages();

  // A failed refresh keeps showing the goals already loaded.
  if (goals.data === undefined) {
    if (!goals.isError) return <LoadingMessage />;
    return (
      <p role="alert" className="text-danger-700 text-sm">
        {t.rewards.loadFailed}
      </p>
    );
  }
  const open = goals.data.filter((goal) => goal.claimedAt === null);
  const claimed = goals.data.filter((goal) => goal.claimedAt !== null);
  return (
    <div className="flex flex-col gap-8">
      {(['shared', 'yours', 'members'] as const).map((section) => (
        <GoalSection
          key={section}
          section={section}
          goals={open.filter((goal) => sectionOf(goal, user.id) === section)}
          userId={user.id}
          isAdult={isAdult}
        />
      ))}
      {claimed.length > 0 && <ClaimedRewards goals={claimed} userId={user.id} />}
    </div>
  );
}

function GoalSection({
  section,
  goals,
  userId,
  isAdult,
}: {
  section: Section;
  goals: Goal[];
  userId: string;
  isAdult: boolean;
}) {
  const { heading, empty } = useMessages().rewards.sections[section];
  const headingId = `${section}-goals-heading`;
  if (goals.length === 0 && empty === null) return null;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-ink text-lg font-semibold">
        {heading}
      </h2>
      {goals.length === 0 ? (
        <p className={emptyClassName}>{empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} userId={userId} isAdult={isAdult} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ClaimedRewards({ goals, userId }: { goals: Goal[]; userId: string }) {
  const t = useMessages();
  return (
    <section aria-labelledby="claimed-heading" className="flex flex-col gap-3">
      <h2 id="claimed-heading" className="text-ink text-lg font-semibold">
        {t.rewards.claimedHeading}
      </h2>
      <ul className="divide-line bg-surface shadow-card flex flex-col divide-y rounded-2xl">
        {goals.map((goal) => (
          <li key={goal.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <span className="text-ink font-medium">{goal.title}</span>
            <span className="text-ink-muted shrink-0">
              {ownerLabel(goal, userId, t)} ·{' '}
              {t.rewards.claimedOn(t.common.dayAndMonth(new Date(goal.claimedAt ?? '')))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
