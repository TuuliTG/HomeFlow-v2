import { useState } from 'react';

import { type Goal, isClaimableBy, membersShortOfMinimum, nameOf } from '@/features/rewards/goal';
import { useClaimGoalReward, useDeleteGoal } from '@/features/rewards/useGoals';
import { type Messages, useMessages } from '@/lib/i18n/i18n';

interface GoalCardProps {
  goal: Goal;
  userId: string;
  /** Only adults delete goals (ADR 0007). */
  isAdult: boolean;
}

/**
 * An open goal and its progress. Family goals and the user's own can be claimed once reached; someone
 * else's personal goal is followed. Adults can delete any of them.
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
      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4"
    >
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-900">{goal.title}</h3>
          {othersName && <p className="text-sm text-slate-600">{t.othersGoal(othersName)}</p>}
          {goal.minPointsPerMember !== null && (
            <p className="text-sm text-slate-600">{t.minimumFromEach(goal.minPointsPerMember)}</p>
          )}
        </div>
        <span className="shrink-0 text-sm text-slate-600">
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
        className="h-3 overflow-hidden rounded-full bg-slate-200"
      >
        <div
          className={`h-full rounded-full ${goal.reached ? 'bg-emerald-600' : 'bg-brand-600'}`}
          style={{ width: `${String(percent)}%` }}
        />
      </div>
      {goal.minPointsPerMember !== null && (
        <MemberMinimums goal={goal} minimum={goal.minPointsPerMember} userId={userId} />
      )}
      {!goal.reached ? (
        <p className="text-sm text-slate-600">{progressMessage(goal, messages)}</p>
      ) : othersName ? (
        <p className="text-sm font-medium text-emerald-800">{t.othersReached(othersName)}</p>
      ) : (
        <ClaimReward goal={goal} userId={userId} />
      )}
      {isAdult && <DeleteGoal goal={goal} userId={userId} />}
    </li>
  );
}

/** What is still missing from a goal that isn't reached: points, or members' minimums. */
function progressMessage(goal: Goal, t: Messages): string {
  const missing = goal.targetPoints - goal.points;
  if (missing > 0) return t.rewards.goal.pointsToGo(missing);
  return t.rewards.goal.membersShort(membersShortOfMinimum(goal).length);
}

/** Each member's points towards a family goal's minimum, so the family sees who still has to help. */
function MemberMinimums({
  goal,
  minimum,
  userId,
}: {
  goal: Goal;
  minimum: number;
  userId: string;
}) {
  const t = useMessages();
  return (
    <ul aria-label={t.rewards.goal.memberPointsLabel(goal.title)} className="flex flex-col gap-1">
      {goal.memberPoints.map((member) => {
        const hasShare = member.points >= minimum;
        return (
          <li key={member.id} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-slate-700">
              {member.id === userId ? t.common.you : nameOf(member, t)}
            </span>
            <span className={hasShare ? 'font-medium text-emerald-800' : 'text-slate-600'}>
              {Math.min(member.points, minimum)} / {minimum}
              {hasShare && (
                <>
                  <span aria-hidden="true"> ✓</span>
                  <span className="sr-only">{t.rewards.goal.memberDone}</span>
                </>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ClaimReward({ goal, userId }: { goal: Goal; userId: string }) {
  const claim = useClaimGoalReward(userId);
  const t = useMessages().rewards.goal;
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-emerald-800">{t.reached}</p>
        <button
          type="button"
          aria-label={t.claimLabel(goal.title)}
          disabled={claim.isPending}
          onClick={() => {
            claim.mutate(goal.id);
          }}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60"
        >
          {t.claim}
        </button>
      </div>
      {claim.isError && (
        <p role="alert" className="text-sm text-red-700">
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
        className="-my-2 min-h-11 w-fit text-sm font-semibold text-red-700 hover:underline"
      >
        {common.delete}
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
      <p className="text-sm text-red-900">{t.confirmDelete(goal.title, goal.owner === null)}</p>
      {deleteGoal.isError && (
        <p role="alert" className="text-sm text-red-700">
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
          className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900 disabled:opacity-60"
        >
          {common.yesDelete}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsConfirming(false);
          }}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          {common.keepIt}
        </button>
      </div>
    </div>
  );
}
