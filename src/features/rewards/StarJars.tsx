import { useEffect, useRef } from 'react';

import { StarIcon } from '@/components/ui/icons';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import {
  type Goal,
  isClaimableBy,
  type JarFill,
  jarFill,
  participantsShortOfMinimum,
} from '@/features/rewards/goal';
import { RewardCelebration } from '@/features/rewards/RewardCelebration';
import { useClaimGoalReward, useGoals } from '@/features/rewards/useGoals';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

const heroClassName = 'bg-brand-900 shadow-hero rounded-3xl p-5 text-white';

interface StarJarsProps {
  /** When the user's points last changed, e.g. a task marked done or undone: the jars refresh then. */
  pointsChangedAt: number;
}

/**
 * The user's open goals, their own and the shared ones they take part in, each as a jar that fills with
 * points and whose reward they claim once reached: the Me page's picture of progress for children, who
 * have no Rewards screen (ADR 0007).
 */
export function StarJars({ pointsChangedAt }: StarJarsProps) {
  return (
    <>
      <Jars pointsChangedAt={pointsChangedAt} />
      <RewardCelebration />
    </>
  );
}

function Jars({ pointsChangedAt }: StarJarsProps) {
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
  const user = useLoggedInUser();
  const messages = useMessages();
  const t = messages.rewards.jar;
  const goalT = messages.rewards.goal;
  const fill = jarFill(goal, user.id);
  const counted = fill.others + fill.own;
  const headingId = `jar-${goal.id}`;

  return (
    <section aria-labelledby={headingId} className={`${heroClassName} flex items-center gap-5`}>
      <div
        role="progressbar"
        aria-label={goalT.progressLabel(goal.title)}
        aria-valuemin={0}
        aria-valuemax={goal.targetPoints}
        aria-valuenow={counted}
        aria-valuetext={goalT.progressValue(counted, goal.targetPoints)}
        className="relative h-32 w-24 shrink-0"
      >
        <span className="bg-brand-200 absolute inset-x-5 top-0 h-3 rounded-md" />
        <span className="border-brand-200 bg-brand-700 absolute inset-x-0 top-2 bottom-0 overflow-hidden rounded-t-[1.75rem] rounded-b-[2rem] border-[3px]">
          <JarLayer className="bg-points-400" from={0} points={fill.others} goal={goal} />
          {fill.ownRoom > 0 && <OwnRoom goal={goal} fill={fill} />}
          <StarIcon className="text-points-100 absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2 fill-current opacity-80" />
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-brand-100 text-sm font-semibold">{t.savingFor}</p>
        <h2 id={headingId} className="text-2xl leading-tight font-extrabold break-words">
          {goal.title}
        </h2>
        <p className="flex items-baseline gap-1.5">
          <span className="text-4xl leading-none font-extrabold tracking-tight">{counted}</span>
          <span className="text-brand-100 font-semibold">{t.ofTarget(goal.targetPoints)}</span>
        </p>
        <JarStatus goal={goal} fill={fill} />
        {fill.ownRoom > 0 && <JarLegend fill={fill} />}
      </div>
    </section>
  );
}

interface JarLayerProps {
  goal: Goal;
  /** Where the layer starts, in points from the bottom of the jar. */
  from: number;
  points: number;
  className: string;
}

/** A layer of points in the jar, on the scale of the goal's target. */
function JarLayer({ goal, from, points, className }: JarLayerProps) {
  const percentOf = (value: number) => `${String((value / goal.targetPoints) * 100)}%`;
  return (
    <span
      className={`absolute inset-x-0 motion-safe:transition-[height] motion-safe:duration-700 ${className}`}
      style={{ bottom: percentOf(from), height: percentOf(points) }}
    />
  );
}

/** The top of the jar, kept for the user's own minimum: only their points fill it. */
function OwnRoom({ goal, fill }: { goal: Goal; fill: JarFill }) {
  const floor = goal.targetPoints - fill.ownRoom;
  return (
    <>
      <JarLayer
        className="bg-[repeating-linear-gradient(135deg,var(--color-share-400)_0_5px,transparent_5px_11px)] opacity-60"
        from={floor}
        points={fill.ownRoom}
        goal={goal}
      />
      <JarLayer className="bg-share-400" from={floor} points={fill.own} goal={goal} />
    </>
  );
}

/** Which colour in the jar is whose, when part of it is kept for the user. */
function JarLegend({ fill }: { fill: JarFill }) {
  const t = useMessages().rewards.jar;
  return (
    <ul className="text-brand-100 mt-1 flex flex-col gap-1 text-sm font-semibold">
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="bg-points-400 size-3 rounded-sm" />
        {t.everyonesPoints}
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="bg-share-400 size-3 rounded-sm" />
        {t.yourShare(fill.own, fill.ownRoom)}
      </li>
    </ul>
  );
}

/**
 * What's left to do: points to go, the user's own points to go, others' minimums still to earn, or
 * claiming the reward.
 */
function JarStatus({ goal, fill }: { goal: Goal; fill: JarFill }) {
  const goalT = useMessages().rewards.goal;
  if (goal.reached) return <ClaimFromJar goal={goal} />;
  const missing = goal.targetPoints - fill.others - fill.own;
  const yourMissing = fill.ownRoom - fill.own;
  const othersMissing = missing - yourMissing;
  return (
    <>
      {othersMissing > 0 && (
        <p className="text-brand-100 font-semibold">{goalT.pointsToGo(missing)}</p>
      )}
      {yourMissing > 0 && (
        <p className="text-share-300 font-extrabold">{goalT.yourShareToGo(yourMissing)}</p>
      )}
      {missing === 0 && (
        <p className="text-brand-100 font-semibold">
          {goalT.participantsShort(participantsShortOfMinimum(goal).length)}
        </p>
      )}
    </>
  );
}

function ClaimFromJar({ goal }: { goal: Goal }) {
  const user = useLoggedInUser();
  const claim = useClaimGoalReward(user.id);
  const t = useMessages().rewards.goal;
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="font-semibold">{t.reached}</p>
      <button
        type="button"
        aria-label={t.claimLabel(goal.title)}
        disabled={claim.isPending}
        onClick={() => {
          claim.mutate(goal);
        }}
        className="bg-points-400 text-brand-900 hover:bg-points-100 min-h-11 rounded-full px-5 font-extrabold disabled:opacity-60"
      >
        {t.claim}
      </button>
      {claim.isError && (
        <p role="alert" className="text-danger-200 text-sm font-semibold">
          {t.claimFailed}
        </p>
      )}
    </div>
  );
}
