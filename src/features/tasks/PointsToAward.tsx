import { useId, useState } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import type { TaskWaitingForPoints } from '@/features/tasks/pointsApi';
import { DEFAULT_POINTS, MAX_POINTS, MIN_POINTS } from '@/features/tasks/task';
import {
  useAwardTaskPoints,
  useMembership,
  useTasksWaitingForPoints,
} from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

const POINT_CHOICES = Array.from(
  { length: MAX_POINTS - MIN_POINTS + 1 },
  (_, index) => MIN_POINTS + index,
);

/**
 * For adults: the tasks children added whose points are still to be awarded, done ones first, each with
 * a choice of points (ADR 0004). Hidden when there are none.
 */
export function PointsToAward() {
  const user = useLoggedInUser();
  const membership = useMembership(user.id);
  const isAdult = membership.data?.isChild === false;
  const waiting = useTasksWaitingForPoints(user.id, isAdult);
  const headingId = useId();
  const t = useMessages().tasks.award;

  if (!isAdult || !waiting.data?.length) return null;
  return (
    <section
      aria-labelledby={headingId}
      className="border-notice-200 bg-notice-50 flex flex-col gap-3 rounded-2xl border p-4"
    >
      <h2 id={headingId} className="text-ink font-semibold">
        {t.heading}
      </h2>
      <p className="text-ink text-sm">{t.hint}</p>
      <ul className="flex flex-col gap-3">
        {waiting.data.map((task) => (
          <AwardRow key={task.id} task={task} userId={user.id} />
        ))}
      </ul>
    </section>
  );
}

function AwardRow({ task, userId }: { task: TaskWaitingForPoints; userId: string }) {
  const [points, setPoints] = useState(DEFAULT_POINTS);
  const award = useAwardTaskPoints(userId);
  const selectId = useId();
  const { common, tasks } = useMessages();
  const t = tasks.award;
  const doneBy =
    task.completedBy === null ? t.notDoneYet : t.doneBy(task.completerName ?? common.someone);

  return (
    <li className="bg-surface flex flex-col gap-2 rounded-xl p-3">
      <div>
        <p className="text-ink font-semibold">{task.title}</p>
        <p className="text-ink-muted text-xs">{doneBy}</p>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor={selectId} className="sr-only">
          {t.pointsFor(task.title)}
        </label>
        <select
          id={selectId}
          value={points}
          onChange={(event) => {
            setPoints(Number(event.target.value));
          }}
          className={`${inputClassName} w-fit`}
        >
          {POINT_CHOICES.map((choice) => (
            <option key={choice} value={choice}>
              {common.points(choice)}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label={t.awardLabel(task.title)}
          disabled={award.isPending}
          onClick={() => {
            award.mutate({ taskId: task.id, points });
          }}
          className="bg-brand-700 hover:bg-brand-900 rounded-xl px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {t.award}
        </button>
      </div>
      {award.isError && (
        <p role="alert" className="text-danger-700 text-xs">
          {t.failed}
        </p>
      )}
    </li>
  );
}
