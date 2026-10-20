import { useEffect, useRef } from 'react';
import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { StarIcon } from '@/components/ui/icons';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { type Goal, isClaimableBy, participantsShortOfMinimum } from '@/features/rewards/goal';
import { useGoals } from '@/features/rewards/useGoals';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

const heroClassName = 'bg-brand-900 shadow-hero rounded-3xl p-5 text-white';

interface StarJarsProps {
  /** When the user's points last changed, e.g. a task marked done or undone: the jars refresh then. */
  pointsChangedAt: number;
}

/**
 * The user's open goals, their own and the shared ones they take part in, each as a jar that fills with
 * points: the Me page's picture of progress for children (ADR 0007).
 */
export function StarJars({ pointsChangedAt }: StarJarsProps) {
  const user = useLoggedInUser();
  const goals = useGoals(user.id);
  const t = useMessages().rewards.jar;
  const { refetch } = goals;
  const shownChangeAt = useRef(pointsChangedAt);
  useEffect(() => {
    if (pointsChangedAt === shownChangeAt.current) return;
    shownChangeAt.current = pointsChangedAt;
    void refetch();
  }, [pointsChangedAt, refetch]);

  if (goals.data === undefined) {
    if (!goals.isError) return <LoadingMessage />;
    return (
      <p role="alert" className="text-danger-700 text-sm">
        {t.loadFailed}
      </p>
    );
  }
  const open = goals.data.filter((goal) => goal.claimedAt === null && isClaimableBy(goal, user.id));
  if (open.length === 0) {
    return (
      <section aria-labelledby="no-goal-heading" className={`${heroClassName} flex flex-col gap-1`}>
        <h2 id="no-goal-heading" className="text-2xl font-extrabold">
          {t.noGoal}
        </h2>
        <p className="text-brand-100 text-[0.9375rem]">{t.noGoalHint}</p>
      </section>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {open.map((goal) => (
        <StarJar key={goal.id} goal={goal} />
      ))}
    </div>
  );
}

function StarJar({ goal }: { goal: Goal }) {
  const messages = useMessages();
  const t = messages.rewards.jar;
  const goalT = messages.rewards.goal;
  const shownPoints = Math.min(goal.points, goal.targetPoints);
  const percent = Math.round((shownPoints / goal.targetPoints) * 100);
  const headingId = `jar-${goal.id}`;

  return (
    <section aria-labelledby={headingId} className={`${heroClassName} flex items-center gap-5`}>
      <div
        role="progressbar"
        aria-label={goalT.progressLabel(goal.title)}
        aria-valuemin={0}
        aria-valuemax={goal.targetPoints}
        aria-valuenow={shownPoints}
        aria-valuetext={goalT.progressValue(shownPoints, goal.targetPoints)}
        className="relative h-32 w-24 shrink-0"
      >
        <span className="bg-brand-200 absolute inset-x-5 top-0 h-3 rounded-md" />
        <span className="border-brand-200 bg-brand-700 absolute inset-x-0 top-2 bottom-0 overflow-hidden rounded-t-[1.75rem] rounded-b-[2rem] border-[3px]">
          <span
            className="bg-points-400 absolute inset-x-0 bottom-0 motion-safe:transition-[height] motion-safe:duration-700"
            style={{ height: `${String(percent)}%` }}
          />
          <StarIcon className="text-points-100 absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2 fill-current opacity-80" />
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-brand-100 text-sm font-semibold">{t.savingFor}</p>
        <h2 id={headingId} className="text-2xl leading-tight font-extrabold break-words">
          {goal.title}
        </h2>
        <p className="flex items-baseline gap-1.5">
          <span className="text-4xl leading-none font-extrabold tracking-tight">{shownPoints}</span>
          <span className="text-brand-100 font-semibold">{t.ofTarget(goal.targetPoints)}</span>
        </p>
        <JarStatus goal={goal} shownPoints={shownPoints} />
      </div>
    </section>
  );
}

/** What's left to do: points to go, others' minimums still to earn, or claiming the reward. */
function JarStatus({ goal, shownPoints }: { goal: Goal; shownPoints: number }) {
  const messages = useMessages();
  const goalT = messages.rewards.goal;
  if (goal.reached) {
    return (
      <p className="font-semibold">
        {goalT.reached}{' '}
        <Link to={paths.rewards} className="underline hover:no-underline">
          {messages.rewards.jar.claimOnRewards}
        </Link>
      </p>
    );
  }
  const missing = goal.targetPoints - shownPoints;
  return (
    <p className="text-brand-100 font-semibold">
      {missing > 0
        ? goalT.pointsToGo(missing)
        : goalT.participantsShort(participantsShortOfMinimum(goal).length)}
    </p>
  );
}
