import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import type { HouseholdCompletedTask } from '@/features/tasks/task';
import { TaskFavouriteStar } from '@/features/tasks/TaskFavouriteStar';
import { TaskHelpersLine } from '@/features/tasks/TaskHelpersLine';
import { useHouseholdCompletedTasks, useMembership } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';
import { type Messages, useMessages } from '@/lib/i18n/i18n';

function doneByLabel(
  { completedBy, completerName }: HouseholdCompletedTask,
  userId: string,
  t: Messages,
): string {
  const { doneBy } = t.tasks.completed;
  if (completedBy === userId) return doneBy.you;
  return completerName === null ? doneBy.someone : doneBy.named(completerName);
}

/** The household's recently done tasks, shown on the board with "Show completed". */
export function HouseholdCompletedTasks() {
  const user = useLoggedInUser();
  const completed = useHouseholdCompletedTasks(user.id);
  const t = useMessages();

  return (
    <section aria-labelledby="household-completed-heading" className="mt-4 flex flex-col gap-3">
      <h2 id="household-completed-heading" className="text-ink text-lg font-semibold">
        {t.tasks.completed.heading}
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
  const t = useMessages();
  // Adding again is for whoever may add tasks: adults, and children an adult lets.
  const canAddTasks = useMembership(userId).data?.canAddTasks === true;
  if (completed.data === undefined) {
    if (!completed.isError) return <LoadingMessage />;
    return (
      <p role="alert" className="text-danger-700 text-sm">
        {t.tasks.completed.loadFailed}
      </p>
    );
  }
  if (completed.data.length === 0) {
    return (
      <p className="border-line-strong bg-surface text-ink-muted rounded-2xl border border-dashed p-6 text-sm">
        {t.tasks.completed.empty}
      </p>
    );
  }
  return (
    <ul className="divide-line bg-surface shadow-card flex flex-col divide-y rounded-2xl">
      {completed.data.map((task) => (
        <li key={task.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <div className="flex min-w-0 flex-col gap-0.5 break-words">
            <span className="text-ink font-medium">{task.title}</span>
            <span className="text-ink-muted">
              {doneByLabel(task, userId, t)} · {t.common.shortDate(new Date(task.completedAt))}
              {` · ${task.points === null ? t.tasks.card.waitingForPoints : t.common.points(task.points)}`}
            </span>
            <TaskHelpersLine helpers={task.helpers} />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {canAddTasks && (
              <Link
                to={paths.addTaskAgain(task.title)}
                aria-label={t.tasks.completed.addAgainLabel(task.title)}
                className="text-brand-600 hover:text-brand-900 flex min-h-11 items-center font-semibold"
              >
                {t.tasks.completed.addAgain}
              </Link>
            )}
            <TaskFavouriteStar title={task.title} currentUserId={userId} />
          </div>
        </li>
      ))}
    </ul>
  );
}
