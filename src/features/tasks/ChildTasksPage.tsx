import { useId } from 'react';
import { Link, useLocation, useParams } from 'react-router';

import { paths } from '@/app/paths';
import { AddLink } from '@/components/ui/AddLink';
import { StarIcon } from '@/components/ui/icons';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { TaskTypeIcon } from '@/components/ui/TaskTypeIcon';
import { childTaskList, scheduleOf, tasksToCopy } from '@/features/tasks/childTasks';
import type { Task } from '@/features/tasks/task';
import { useHouseholdMembers } from '@/features/tasks/useHelpers';
import { useTasks } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

/**
 * An adult's page of one child's tasks, to set them up: the always ones, then the custom ones, each opening to edit,
 * with a plus to add one and a way to copy them all to another child (ADR 0004).
 */
export function ChildTasksPage() {
  const { childId = '' } = useParams();
  const user = useLoggedInUser();
  const members = useHouseholdMembers(user.id);
  const tasks = useTasks(user.id);
  const t = useMessages();

  if (members.data === undefined || tasks.data === undefined) {
    if (!members.isError && !tasks.isError) return <LoadingMessage />;
    return (
      <p role="alert" className="text-danger-700 text-sm">
        {t.tasks.me.loadFailed}
      </p>
    );
  }
  const children = members.data.filter((member) => member.isChild);
  const child = children.find((member) => member.id === childId);
  if (!child) return <p className="text-ink-muted text-sm">{t.tasks.childTasks.notFound}</p>;
  const name = child.name ?? t.common.someone;
  const { always, custom } = childTaskList(tasks.data, childId);

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title={t.tasks.childTasks.title(name)} />
        <AddLink to={paths.newChildTask(childId)} label={t.tasks.childTasks.add(name)} />
      </div>
      <div className="flex flex-col gap-8">
        {always.length + custom.length === 0 && (
          <p className="text-ink-muted text-sm">{t.tasks.childTasks.empty}</p>
        )}
        <TaskSection heading={t.tasks.childTasks.kinds.always} tasks={always} childId={childId} />
        <TaskSection heading={t.tasks.childTasks.kinds.custom} tasks={custom} childId={childId} />
        <CopyTo
          tasks={tasks.data}
          fromChildId={childId}
          others={children.filter((other) => other.id !== childId)}
        />
      </div>
    </>
  );
}

interface TaskSectionProps {
  heading: string;
  tasks: Task[];
  childId: string;
}

/** A list of the child's tasks, left out while empty. */
function TaskSection({ heading, tasks, childId }: TaskSectionProps) {
  const headingId = useId();
  if (tasks.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-ink text-xl font-extrabold">
        {heading}
      </h2>
      <ul aria-labelledby={headingId} className="flex flex-col gap-2">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} childId={childId} />
        ))}
      </ul>
    </section>
  );
}

/** A task as a row opening it to edit: its icon, name, when it comes up and its stars. */
function TaskRow({ task, childId }: { task: Task; childId: string }) {
  const t = useMessages();
  return (
    <li>
      <Link
        to={paths.editTask(task.id)}
        state={{ returnToChild: childId }}
        className="bg-surface shadow-card hover:bg-brand-50 flex items-center gap-3 rounded-2xl px-4 py-3"
      >
        <TaskTypeIcon type={task.type} icon={task.icon} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-ink font-bold break-words">{task.title}</span>
          <span className="text-ink-muted text-xs font-semibold">{scheduleOf(task, t)}</span>
        </span>
        {task.points !== null && task.points > 0 && (
          <span
            role="img"
            aria-label={t.common.points(task.points)}
            className="text-points-600 flex shrink-0 items-center gap-0.5 text-sm font-bold"
          >
            {task.points}
            <StarIcon className="size-4 fill-current" />
          </span>
        )}
      </Link>
    </li>
  );
}

interface CopyToProps {
  tasks: Task[];
  fromChildId: string;
  others: { id: string; name: string | null }[];
}

/**
 * A link for each other child who lacks some of the tasks, to choose which to copy to them, and what was copied
 * last (`copiedTo` in the location's state); left out when there is neither.
 */
function CopyTo({ tasks, fromChildId, others }: CopyToProps) {
  const { common, tasks: t } = useMessages();
  const copiedTo = useCopiedTo();
  const copied = others.find((other) => other.id === copiedTo);
  const withTasks = others.filter((other) => tasksToCopy(tasks, fromChildId, other.id).length > 0);
  if (withTasks.length === 0 && !copied) return null;
  return (
    <div className="flex flex-col items-start gap-2">
      {withTasks.map((other) => (
        <Link
          key={other.id}
          to={paths.copyChildTasks(fromChildId, other.id)}
          className="text-brand-600 flex min-h-11 items-center text-sm font-medium underline"
        >
          {t.childTasks.copyTo(other.name ?? common.someone)}
        </Link>
      ))}
      {copied && (
        <p role="status" className="text-done-800 text-sm">
          {t.childTasks.copied(copied.name ?? common.someone)}
        </p>
      )}
    </div>
  );
}

/** The child the tasks were just copied to (`CopyChildTasksPage`), if any. */
function useCopiedTo(): string | null {
  const state: unknown = useLocation().state;
  if (typeof state !== 'object' || state === null || !('copiedTo' in state)) return null;
  return typeof state.copiedTo === 'string' ? state.copiedTo : null;
}
