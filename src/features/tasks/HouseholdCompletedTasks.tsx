import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { formatShortDate } from '@/lib/dates';
import type { HouseholdCompletedTask } from '@/features/tasks/task';
import { useHouseholdCompletedTasks } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';

function doneByLabel({ completedBy, completerName }: HouseholdCompletedTask, userId: string) {
  if (completedBy === userId) return 'you';
  return completerName ?? 'someone';
}

/** The household's recently done tasks, shown on the board with "Show completed". */
export function HouseholdCompletedTasks() {
  const user = useLoggedInUser();
  const completed = useHouseholdCompletedTasks(user.id);

  return (
    <section aria-labelledby="household-completed-heading" className="mt-4 flex flex-col gap-3">
      <h2 id="household-completed-heading" className="text-lg font-semibold text-slate-900">
        Completed
      </h2>
      <CompletedTasksBody completed={completed} userId={user.id} />
    </section>
  );
}

function CompletedTasksBody({
  completed,
  userId,
}: {
  completed: ReturnType<typeof useHouseholdCompletedTasks>;
  userId: string;
}) {
  if (completed.data === undefined) {
    if (!completed.isError) return <LoadingMessage />;
    return (
      <p role="alert" className="text-sm text-red-700">
        We couldn&apos;t load the completed tasks. Check your connection and reload the page.
      </p>
    );
  }
  if (completed.data.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
        Nothing done yet.
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
      {completed.data.map((task) => (
        <li key={task.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-slate-900">{task.title}</span>
            <span className="text-slate-500">
              Done by {doneByLabel(task, userId)} · {formatShortDate(new Date(task.completedAt))}
              {task.points !== null && ` · ${String(task.points)} points`}
            </span>
          </div>
          <Link
            to={paths.addTaskAgain(task.title)}
            aria-label={`Add ${task.title} again`}
            className="text-brand-600 hover:text-brand-900 flex min-h-11 shrink-0 items-center font-semibold"
          >
            Add again
          </Link>
        </li>
      ))}
    </ul>
  );
}
