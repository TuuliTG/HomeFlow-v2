import { useState } from 'react';

import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatShortDate } from '@/features/tasks/dueDate';
import { DueTaskGroups } from '@/features/tasks/DueTaskGroups';
import { TaskFavouriteStar } from '@/features/tasks/TaskFavouriteStar';
import { NewTaskLink } from '@/features/tasks/NewTaskLink';
import { type CompletedTask, isToDoBy, UNDO_WINDOW_MS } from '@/features/tasks/task';
import {
  useCompletedTasks,
  useTasks,
  useTotalPoints,
  useUndoCompleteTask,
} from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';

const emptyClassName =
  'rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600';

export function MyTasksPage() {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          eyebrow="Me"
          title="My tasks"
          description="Things you've picked up, your private tasks and what you've completed."
        />
        <NewTaskLink />
      </div>
      <div className="flex flex-col gap-8">
        <PointsTotal />
        <section aria-labelledby="to-do-heading" className="flex flex-col gap-3">
          <h2 id="to-do-heading" className="text-lg font-semibold text-slate-900">
            To do
          </h2>
          <ToDoList />
        </section>
        <section aria-labelledby="completed-heading" className="flex flex-col gap-3">
          <h2 id="completed-heading" className="text-lg font-semibold text-slate-900">
            Completed
          </h2>
          <CompletedList />
        </section>
      </div>
    </>
  );
}

function PointsTotal() {
  const user = useLoggedInUser();
  const points = useTotalPoints(user.id);

  return (
    <section
      aria-labelledby="points-heading"
      className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4"
    >
      <h2 id="points-heading" className="text-sm font-medium text-slate-600">
        Points earned
      </h2>
      {points.data !== undefined ? (
        <span className="text-brand-900 text-3xl font-bold">{points.data}</span>
      ) : points.isError ? (
        <p role="alert" className="text-sm text-red-700">
          We couldn&apos;t load your points.
        </p>
      ) : (
        <LoadingMessage />
      )}
    </section>
  );
}

function ToDoList() {
  const user = useLoggedInUser();
  const tasks = useTasks(user.id);

  // A failed refresh keeps showing the tasks already loaded.
  if (tasks.data === undefined) {
    if (!tasks.isError) return <LoadingMessage />;
    return (
      <p role="alert" className="text-sm text-red-700">
        We couldn&apos;t load your tasks. Check your connection and reload the page.
      </p>
    );
  }
  const mine = tasks.data.filter((task) => isToDoBy(task, user.id));
  if (mine.length === 0) {
    return <p className={emptyClassName}>Nothing picked up yet. Pick a task on the board.</p>;
  }
  return <DueTaskGroups tasks={mine} currentUserId={user.id} headingLevel={3} />;
}

function CompletedList() {
  const user = useLoggedInUser();
  const completed = useCompletedTasks(user.id);

  if (completed.isPending) return <LoadingMessage />;
  if (completed.isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        We couldn&apos;t load your completed tasks. Check your connection and reload the page.
      </p>
    );
  }
  if (completed.data.length === 0) {
    return <p className={emptyClassName}>Tasks you mark done will show up here.</p>;
  }
  return (
    <ul
      aria-label="Completed tasks"
      className="flex flex-col divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white"
    >
      {completed.data.map((task) => (
        <CompletedItem key={task.id} task={task} userId={user.id} />
      ))}
    </ul>
  );
}

function CompletedItem({ task, userId }: { task: CompletedTask; userId: string }) {
  const undo = useUndoCompleteTask(userId);
  // Checked when the item appears; the database has the final say.
  const [canUndo] = useState(
    () => Date.now() - new Date(task.completedAt).getTime() < UNDO_WINDOW_MS,
  );

  return (
    <li className="flex flex-col gap-1 px-4 py-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-slate-900">{task.title}</span>
          <span className="text-slate-500">
            Done {formatShortDate(new Date(task.completedAt))}
            {task.points !== null && ` · ${String(task.points)} points`}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canUndo && (
            <button
              type="button"
              aria-label={`Undo: ${task.title}`}
              disabled={undo.isPending}
              onClick={() => {
                undo.mutate(task.id);
              }}
              className="text-brand-900 flex min-h-11 items-center px-1 font-semibold hover:underline disabled:opacity-60"
            >
              Undo
            </button>
          )}
          <TaskFavouriteStar title={task.title} currentUserId={userId} />
        </div>
      </div>
      {undo.isError && (
        <p role="alert" className="text-xs text-red-700">
          We couldn&apos;t undo this. Tasks can be undone for an hour, before their next one is
          done.
        </p>
      )}
    </li>
  );
}
