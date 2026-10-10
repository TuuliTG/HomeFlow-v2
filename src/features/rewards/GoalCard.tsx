import { useState } from 'react';

import { type Goal, isManagedBy, membersShortOfMinimum, nameOf } from '@/features/rewards/goal';
import { useClaimGoalReward, useDeleteGoal } from '@/features/rewards/useGoals';

/**
 * An open goal and its progress. Family goals and the user's own can be claimed once reached, and
 * deleted; someone else's personal goal is only followed.
 */
export function GoalCard({ goal, userId }: { goal: Goal; userId: string }) {
  const canManage = isManagedBy(goal, userId);
  const othersName = goal.owner && !canManage ? nameOf(goal.owner) : null;
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
          {othersName && <p className="text-sm text-slate-600">{othersName}&apos;s goal</p>}
          {goal.minPointsPerMember !== null && (
            <p className="text-sm text-slate-600">
              At least {goal.minPointsPerMember} {pointsWord(goal.minPointsPerMember)} from each
              member
            </p>
          )}
        </div>
        <span className="shrink-0 text-sm text-slate-600">
          {shownPoints} / {goal.targetPoints} points
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`Progress towards ${goal.title}`}
        aria-valuemin={0}
        aria-valuemax={goal.targetPoints}
        aria-valuenow={shownPoints}
        aria-valuetext={`${String(shownPoints)} of ${String(goal.targetPoints)} points`}
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
        <p className="text-sm text-slate-600">{progressMessage(goal)}</p>
      ) : othersName ? (
        <p className="text-sm font-medium text-emerald-800">{othersName} reached this goal!</p>
      ) : (
        <ClaimReward goal={goal} userId={userId} />
      )}
      {canManage && <DeleteGoal goal={goal} userId={userId} />}
    </li>
  );
}

function pointsWord(count: number): string {
  return count === 1 ? 'point' : 'points';
}

/** What is still missing from a goal that isn't reached: points, or members' minimums. */
function progressMessage(goal: Goal): string {
  const missing = goal.targetPoints - goal.points;
  if (missing > 0) return `${String(missing)} more ${pointsWord(missing)} to go`;
  const short = membersShortOfMinimum(goal).length;
  return `Enough points! ${short === 1 ? 'One member still needs' : `${String(short)} members still need`} to earn their share.`;
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
  return (
    <ul
      aria-label={`Points from each member towards ${goal.title}`}
      className="flex flex-col gap-1"
    >
      {goal.memberPoints.map((member) => {
        const hasShare = member.points >= minimum;
        return (
          <li key={member.id} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-slate-700">{member.id === userId ? 'You' : nameOf(member)}</span>
            <span className={hasShare ? 'font-medium text-emerald-800' : 'text-slate-600'}>
              {Math.min(member.points, minimum)} / {minimum}
              {hasShare && (
                <>
                  <span aria-hidden="true"> ✓</span>
                  <span className="sr-only">, done</span>
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
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-emerald-800">Goal reached!</p>
        <button
          type="button"
          aria-label={`Claim reward: ${goal.title}`}
          disabled={claim.isPending}
          onClick={() => {
            claim.mutate(goal.id);
          }}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60"
        >
          Claim reward
        </button>
      </div>
      {claim.isError && (
        <p role="alert" className="text-sm text-red-700">
          We couldn&apos;t claim the reward. Check your connection and try again.
        </p>
      )}
    </>
  );
}

/** Deleting asks for confirmation first, since the goal's progress is lost. */
function DeleteGoal({ goal, userId }: { goal: Goal; userId: string }) {
  const deleteGoal = useDeleteGoal(userId);
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isConfirming) {
    return (
      <button
        type="button"
        aria-label={`Delete goal: ${goal.title}`}
        onClick={() => {
          setIsConfirming(true);
        }}
        className="-my-2 min-h-11 w-fit text-sm font-semibold text-red-700 hover:underline"
      >
        Delete
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
      <p className="text-sm text-red-900">
        Delete &ldquo;{goal.title}&rdquo;
        {goal.owner === null && ' for everyone in the household'}? This can&apos;t be undone.
      </p>
      {deleteGoal.isError && (
        <p role="alert" className="text-sm text-red-700">
          We couldn&apos;t delete the goal. Try again.
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
          Yes, delete
        </button>
        <button
          type="button"
          onClick={() => {
            setIsConfirming(false);
          }}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Keep it
        </button>
      </div>
    </div>
  );
}
