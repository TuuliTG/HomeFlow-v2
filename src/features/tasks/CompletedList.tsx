import { useState } from 'react';
import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { CheckIcon } from '@/components/ui/icons';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { emptyClassName } from '@/features/tasks/meStyles';
import {
  canChooseHelpers,
  type CompletedTask,
  doersShare,
  type HelpedTask,
  UNDO_WINDOW_MS,
} from '@/features/tasks/task';
import { TaskFavouriteStar } from '@/features/tasks/TaskFavouriteStar';
import { TaskHelpersLine } from '@/features/tasks/TaskHelpersLine';
import { useHelpedTasks } from '@/features/tasks/useHelpers';
import { useCompletedTasks, useUndoCompleteTask } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

/** A task the user did, or helped someone else with. */
type CompletedEntry = { kind: 'done'; task: CompletedTask } | { kind: 'helped'; task: HelpedTask };

function newestFirst(done: CompletedTask[], helped: HelpedTask[]): CompletedEntry[] {
  return [
    ...done.map((task) => ({ kind: 'done' as const, task })),
    ...helped.map((task) => ({ kind: 'helped' as const, task })),
  ].sort((a, b) => b.task.completedAt.localeCompare(a.task.completedAt));
}

/** The tasks the user did and those they helped with, so a helper sees their share of the work too. */
export function CompletedList() {
  const user = useLoggedInUser();
  const completed = useCompletedTasks(user.id);
  const helped = useHelpedTasks(user.id);
  const t = useMessages().tasks.me;

  if (completed.isPending || helped.isPending) return <LoadingMessage />;
  if (completed.isError || helped.isError) {
    return (
      <p role="alert" className="text-danger-700 text-sm">
        {t.completedLoadFailed}
      </p>
    );
  }
  const entries = newestFirst(completed.data, helped.data);
  if (entries.length === 0) {
    return <p className={emptyClassName}>{t.completedEmpty}</p>;
  }
  return (
    <ul
      aria-label={t.completedTasks}
      className="divide-line bg-surface shadow-card flex flex-col divide-y rounded-2xl"
    >
      {entries.map((entry) =>
        entry.kind === 'done' ? (
          <CompletedItem key={`done:${entry.task.id}`} task={entry.task} userId={user.id} />
        ) : (
          <HelpedItem key={`helped:${entry.task.id}`} task={entry.task} />
        ),
      )}
    </ul>
  );
}

/** A task the user helped with: who did it and the user's share of its points. */
function HelpedItem({ task }: { task: HelpedTask }) {
  const { common, tasks } = useMessages();
  const t = tasks.me;
  return (
    <li className="flex items-start gap-3 px-4 py-3 text-sm">
      <DoneMark />
      <div className="flex min-w-0 flex-col gap-0.5 break-words">
        <span className="text-ink font-semibold">{task.title}</span>
        <span className="text-ink-muted">
          {t.doneOn(common.shortDate(new Date(task.completedAt)))} · {common.points(task.points)}
        </span>
        <span className="text-brand-900">{t.youHelped(task.doerName ?? common.someone)}</span>
      </div>
    </li>
  );
}

function DoneMark() {
  return (
    <span className="bg-done-100 text-done-700 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
      <CheckIcon className="size-4" strokeWidth={3} />
    </span>
  );
}

function CompletedItem({ task, userId }: { task: CompletedTask; userId: string }) {
  const undo = useUndoCompleteTask(userId);
  const { common, tasks } = useMessages();
  const t = tasks.me;
  // Checked when the item appears; the database has the final say.
  const [now] = useState(Date.now);
  const canUndo = now - new Date(task.completedAt).getTime() < UNDO_WINDOW_MS;
  const ownPoints = doersShare(task);

  return (
    <li className="flex flex-col gap-1 px-4 py-3 text-sm">
      <div className="flex items-start gap-3">
        <DoneMark />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 break-words">
          <span className="text-ink font-semibold">{task.title}</span>
          <span className="text-ink-muted">
            {t.doneOn(common.shortDate(new Date(task.completedAt)))}
            {ownPoints !== null && ` · ${common.points(ownPoints)}`}
          </span>
          <TaskHelpersLine helpers={task.helpers} />
          {canChooseHelpers(task, now) && (
            <Link
              to={paths.taskHelpers(task.id)}
              aria-label={tasks.helpers.whoHelpedLabel(task.title)}
              className="text-brand-900 flex min-h-11 w-fit items-center font-semibold hover:underline"
            >
              {tasks.helpers.whoHelped}
            </Link>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canUndo && (
            <button
              type="button"
              aria-label={t.undoLabel(task.title)}
              disabled={undo.isPending}
              onClick={() => {
                undo.mutate(task.id);
              }}
              className="text-brand-900 flex min-h-11 items-center px-1 font-semibold hover:underline disabled:opacity-60"
            >
              {t.undo}
            </button>
          )}
          <TaskFavouriteStar title={task.title} currentUserId={userId} />
        </div>
      </div>
      {undo.isError && (
        <p role="alert" className="text-danger-700 text-xs">
          {t.undoFailed}
        </p>
      )}
    </li>
  );
}
