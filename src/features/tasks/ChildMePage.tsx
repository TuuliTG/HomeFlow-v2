import { type ReactNode, useId } from 'react';

import { CheckIcon, StarIcon } from '@/components/ui/icons';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { AskedOfYou } from '@/features/tasks/AskedOfYou';
import { CompletedList } from '@/features/tasks/CompletedList';
import { emptyClassName, sectionHeadingClassName } from '@/features/tasks/meStyles';
import { NewTaskLink } from '@/features/tasks/NewTaskLink';
import { isToDoBy, type Task } from '@/features/tasks/task';
import { TaskTypeIcon } from '@/features/tasks/TaskTypeIcon';
import { useCompleteTask, usePickUpTask, useTasks } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

interface ChildMePageProps {
  /** The child's goals and how far they have come, at the top of the page. */
  goals: ReactNode;
}

/**
 * The Me page for a child: their goals, then their tasks and tasks to pick as big tiles with icons and
 * stars, with little text, and what they have done.
 */
export function ChildMePage({ goals }: ChildMePageProps) {
  const t = useMessages().tasks;
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          eyebrow={t.child.eyebrow}
          title={t.child.title}
          description={t.child.description}
        />
        <NewTaskLink />
      </div>
      <div className="flex flex-col gap-8">
        {goals}
        <AskedOfYou headingClassName={sectionHeadingClassName} />
        <ChildTasks />
        <section aria-labelledby="completed-heading" className="flex flex-col gap-3">
          <h2 id="completed-heading" className={sectionHeadingClassName}>
            {t.me.completed}
          </h2>
          <CompletedList />
        </section>
      </div>
    </>
  );
}

/** The tasks the child has picked up, to mark done, and the free ones, to pick up. */
function ChildTasks() {
  const user = useLoggedInUser();
  const tasks = useTasks(user.id);
  const t = useMessages().tasks;

  // A failed refresh keeps showing the tasks already loaded.
  if (tasks.data === undefined) {
    if (!tasks.isError) return <LoadingMessage />;
    return (
      <p role="alert" className="text-danger-700 text-sm">
        {t.me.loadFailed}
      </p>
    );
  }
  const mine = tasks.data.filter((task) => isToDoBy(task, user.id));
  const free = tasks.data.filter((task) => !task.isPrivate && task.pickedUpBy === null);
  return (
    <>
      <TileSection
        heading={t.child.myTasks}
        empty={t.child.nothingToDo}
        tasks={mine}
        action="markDone"
      />
      <TileSection
        heading={t.child.pickOne}
        empty={t.child.nothingToPick}
        tasks={free}
        action="pickUp"
      />
    </>
  );
}

type TileAction = 'markDone' | 'pickUp';

interface TileSectionProps {
  heading: string;
  /** What to say when there are no tasks. */
  empty: string;
  tasks: Task[];
  action: TileAction;
}

function TileSection({ heading, empty, tasks, action }: TileSectionProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className={sectionHeadingClassName}>
        {heading}
      </h2>
      {tasks.length === 0 ? (
        <p className={emptyClassName}>{empty}</p>
      ) : (
        <ul aria-labelledby={headingId} className="flex flex-col gap-3">
          {tasks.map((task) => (
            <TaskTile key={task.id} task={task} action={action} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** A task as a big tile: its icon, name and points as stars, and one button. */
function TaskTile({ task, action }: { task: Task; action: TileAction }) {
  const user = useLoggedInUser();
  const completeTask = useCompleteTask(user.id);
  const pickUpTask = usePickUpTask(user.id);
  const t = useMessages().tasks.card;
  const titleId = useId();
  const mutation = action === 'markDone' ? completeTask : pickUpTask;
  const label = `${t[action]}: ${task.title}`;

  return (
    <li
      aria-labelledby={titleId}
      className="bg-surface shadow-card flex items-center gap-4 rounded-2xl p-4"
    >
      <TaskTypeIcon type={task.type} icon={task.icon} size="lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 id={titleId} className="text-ink text-lg leading-snug font-bold break-words">
          {task.title}
        </h3>
        <PointsAsStars task={task} />
        {mutation.isError && (
          <p role="alert" className="text-danger-700 text-xs">
            {t.failures[action === 'markDone' ? 'complete' : 'pickUp']}
          </p>
        )}
      </div>
      {action === 'markDone' ? (
        <button
          type="button"
          aria-label={label}
          disabled={mutation.isPending}
          onClick={() => {
            completeTask.mutate(task);
          }}
          className="border-brand-600 text-brand-700 hover:bg-brand-50 flex size-14 shrink-0 items-center justify-center rounded-full border-2 disabled:opacity-60"
        >
          <CheckIcon className="size-7" strokeWidth={3} />
        </button>
      ) : (
        <button
          type="button"
          aria-label={label}
          disabled={mutation.isPending}
          onClick={() => {
            pickUpTask.mutate(task.id);
          }}
          className="bg-brand-700 hover:bg-brand-900 min-h-11 shrink-0 rounded-xl px-4 text-[0.9375rem] font-bold text-white disabled:opacity-60"
        >
          {t.pickUp}
        </button>
      )}
    </li>
  );
}

/**
 * One star per point, named in words. A private task earns none, and a child's own shared task waits for an
 * adult to choose its points.
 */
function PointsAsStars({ task }: { task: Task }) {
  const { common, tasks } = useMessages();
  if (task.points === null) {
    return (
      <p className="text-ink-muted text-sm font-semibold">
        {task.isPrivate ? tasks.card.private : tasks.card.waitingForPoints}
      </p>
    );
  }
  return (
    <span role="img" aria-label={common.points(task.points)} className="flex flex-wrap gap-0.5">
      {Array.from({ length: task.points }, (_, index) => (
        <StarIcon key={index} className="text-points-600 size-5 fill-current" />
      ))}
    </span>
  );
}
