import { useState } from 'react';
import { Link } from 'react-router';

import { paths } from '@/app/paths';

import {
  type Goal,
  type GoalParticipant,
  isClaimableBy,
  nameOf,
  participantsShortOfMinimum,
} from '@/features/rewards/goal';
import { useClaimGoalReward, useDeleteGoal } from '@/features/rewards/useGoals';
import { type Messages, useMessages } from '@/lib/i18n/i18n';

interface GoalCardProps {
  goal: Goal;
  userId: string;
  /** Only adults change and delete goals (ADR 0007). */
  isAdult: boolean;
}

/**
 * An open goal and its progress. Shared goals the user takes part in and their own can be claimed once
 * reached; the others are followed. Adults can change or delete any of them.
 */
export function GoalCard({ goal, userId, isAdult }: GoalCardProps) {
  const messages = useMessages();
  const t = messages.rewards.goal;
  const othersName =
    goal.owner && !isClaimableBy(goal, userId) ? nameOf(goal.owner, messages) : null;
  const shownPoints = Math.min(goal.points, goal.targetPoints);
  const percent = Math.round((shownPoints / goal.targetPoints) * 100);

  return (
    <li
      aria-label={goal.title}
      className="bg-surface shadow-card flex flex-col gap-3 rounded-2xl p-4"
    >
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h3 className="text-ink font-semibold">{goal.title}</h3>
          {othersName && <p className="text-ink-muted text-sm">{t.othersGoal(othersName)}</p>}
        </div>
        <span className="text-ink-muted shrink-0 text-sm">
          {t.progress(shownPoints, goal.targetPoints)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={t.progressLabel(goal.title)}
        aria-valuemin={0}
        aria-valuemax={goal.targetPoints}
        aria-valuenow={shownPoints}
        aria-valuetext={t.progressValue(shownPoints, goal.targetPoints)}
        className="bg-line h-3 overflow-hidden rounded-full"
      >
        <div
          className={`h-full rounded-full ${goal.reached ? 'bg-done-600' : 'bg-brand-600'}`}
          style={{ width: `${String(percent)}%` }}
        />
      </div>
      {goal.owner === null && <Participants goal={goal} userId={userId} />}
      {!goal.reached ? (
        <p className="text-ink-muted text-sm">{progressMessage(goal, messages)}</p>
      ) : othersName ? (
        <p className="text-done-800 text-sm font-medium">{t.othersReached(othersName)}</p>
      ) : isClaimableBy(goal, userId) ? (
        <ClaimReward goal={goal} userId={userId} />
      ) : (
        <p className="text-done-800 text-sm font-medium">{t.participantsReached}</p>
      )}
      {isAdult && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            to={paths.editGoal(goal.id)}
            aria-label={t.editLabel(goal.title)}
            className="text-brand-900 -my-2 flex min-h-11 items-center text-sm font-semibold hover:underline"
          >
            {t.edit}
          </Link>
          <DeleteGoal goal={goal} userId={userId} />
        </div>
      )}
    </li>
  );
}

/** What is still missing from a goal that isn't reached: points, or participants' minimums. */
function progressMessage(goal: Goal, t: Messages): string {
  const missing = goal.targetPoints - goal.points;
  if (missing > 0) return t.rewards.goal.pointsToGo(missing);
  return t.rewards.goal.participantsShort(participantsShortOfMinimum(goal).length);
}

/**
 * Who takes part in a shared goal and what each has earned towards it, against their minimum if they
 * have one, so the family sees who still has to help and how much each one has done.
 */
function Participants({ goal, userId }: { goal: Goal; userId: string }) {
  const t = useMessages();
  return (
    <ul aria-label={t.rewards.goal.participantsLabel(goal.title)} className="flex flex-col gap-3">
      {goal.participants.map((participant) => (
        <li key={participant.id} className="flex flex-col gap-1.5 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-ink">
              {participant.id === userId ? t.common.you : nameOf(participant, t)}
            </span>
            <ParticipantPoints participant={participant} />
          </div>
          <ContributionBar participant={participant} targetPoints={goal.targetPoints} />
        </li>
      ))}
    </ul>
  );
}

function ParticipantPoints({ participant }: { participant: GoalParticipant }) {
  const t = useMessages().rewards.goal;
  const { points, minPoints } = participant;
  if (minPoints === null) {
    return <span className="text-ink-muted">{t.participantPoints(points)}</span>;
  }
  const hasShare = points >= minPoints;
  return (
    <span className={hasShare ? 'text-done-800 font-medium' : 'text-ink-muted'}>
      {points} / {minPoints}
      {hasShare && (
        <>
          <span aria-hidden="true"> ✓</span>
          <span className="sr-only">{t.participantDone}</span>
        </>
      )}
    </span>
  );
}

/**
 * A participant's points on the scale of the whole goal, with a mark at their minimum, so points past it
 * show too. Decorative: the points next to the name say the same.
 */
function ContributionBar({
  participant,
  targetPoints,
}: {
  participant: GoalParticipant;
  targetPoints: number;
}) {
  const { points, minPoints } = participant;
  const widthOf = (value: number) => `${String(Math.min(value / targetPoints, 1) * 100)}%`;
  const hasShare = minPoints !== null && points >= minPoints;
  return (
    <div aria-hidden="true" className="bg-line relative h-2 rounded-full">
      <div
        className={`absolute inset-y-0 left-0 rounded-full ${hasShare ? 'bg-done-600' : 'bg-brand-600'}`}
        style={{ width: widthOf(points) }}
      />
      {minPoints !== null && (
        <div
          className="bg-ink absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full"
          style={{ left: widthOf(minPoints) }}
        />
      )}
    </div>
  );
}

function ClaimReward({ goal, userId }: { goal: Goal; userId: string }) {
  const claim = useClaimGoalReward(userId);
  const t = useMessages().rewards.goal;
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <p className="text-done-800 text-sm font-medium">{t.reached}</p>
        <button
          type="button"
          aria-label={t.claimLabel(goal.title)}
          disabled={claim.isPending}
          onClick={() => {
            claim.mutate(goal);
          }}
          className="bg-done-700 hover:bg-done-900 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {t.claim}
        </button>
      </div>
      {claim.isError && (
        <p role="alert" className="text-danger-700 text-sm">
          {t.claimFailed}
        </p>
      )}
    </>
  );
}

/** Deleting asks for confirmation first, since the goal's progress is lost. */
function DeleteGoal({ goal, userId }: { goal: Goal; userId: string }) {
  const deleteGoal = useDeleteGoal(userId);
  const [isConfirming, setIsConfirming] = useState(false);
  const { common, rewards } = useMessages();
  const t = rewards.goal;

  if (!isConfirming) {
    return (
      <button
        type="button"
        aria-label={t.deleteLabel(goal.title)}
        onClick={() => {
          setIsConfirming(true);
        }}
        className="text-danger-700 -my-2 min-h-11 w-fit text-sm font-semibold hover:underline"
      >
        {common.delete}
      </button>
    );
  }
  return (
    <div className="border-danger-200 bg-danger-50 flex w-full flex-col gap-3 rounded-xl border p-3">
      <p className="text-danger-900 text-sm">{t.confirmDelete(goal.title, goal.owner === null)}</p>
      {deleteGoal.isError && (
        <p role="alert" className="text-danger-700 text-sm">
          {t.deleteFailed}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={deleteGoal.isPending}
          onClick={() => {
            deleteGoal.mutate(goal.id);
          }}
          className="bg-danger-700 hover:bg-danger-900 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {common.yesDelete}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsConfirming(false);
          }}
          className="border-line-strong bg-surface text-ink hover:bg-page rounded-xl border px-4 py-2 text-sm font-semibold"
        >
          {common.keepIt}
        </button>
      </div>
    </div>
  );
}
