import { useState } from 'react';

import { type Goal, isReached } from '@/features/rewards/goal';
import { useClaimGoalReward, useDeleteGoal } from '@/features/rewards/useGoals';

/** An open goal: its progress, claiming the reward once reached, and deleting it. */
export function GoalCard({ goal, userId }: { goal: Goal; userId: string }) {
  const claim = useClaimGoalReward(userId);
  const reached = isReached(goal);
  const shownPoints = Math.min(goal.points, goal.targetPoints);
  const percent = Math.round((shownPoints / goal.targetPoints) * 100);

  return (
    <li
      aria-label={goal.title}
      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-semibold text-slate-900">{goal.title}</h3>
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
          className={`h-full rounded-full ${reached ? 'bg-emerald-600' : 'bg-brand-600'}`}
          style={{ width: `${String(percent)}%` }}
        />
      </div>
      {reached ? (
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
      ) : (
        <p className="text-sm text-slate-600">
          {goal.targetPoints - goal.points} more{' '}
          {goal.targetPoints - goal.points === 1 ? 'point' : 'points'} to go
        </p>
      )}
      {claim.isError && (
        <p role="alert" className="text-sm text-red-700">
          We couldn&apos;t claim the reward. Check your connection and try again.
        </p>
      )}
      <DeleteGoal goal={goal} userId={userId} />
    </li>
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
        className="w-fit text-sm font-semibold text-red-700 hover:underline"
      >
        Delete
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
      <p className="text-sm text-red-900">
        Delete &ldquo;{goal.title}&rdquo;
        {goal.scope === 'shared' && ' for everyone in the household'}? This can&apos;t be undone.
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
