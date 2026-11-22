import { useEffect, useId, useState } from 'react';

import { CheckIcon, StarIcon } from '@/components/ui/icons';
import { emptyClassName, sectionHeadingClassName } from '@/features/tasks/meStyles';
import {
  type AlwaysTaskState,
  alwaysTaskState,
  isWithoutPoints,
  type Task,
} from '@/features/tasks/task';
import { EditLink } from '@/features/tasks/TaskCardLinks';
import { TaskSwipeToDelete } from '@/features/tasks/TaskSwipeToDelete';
import { TaskTypeIcon } from '@/components/ui/TaskTypeIcon';
import { useCompleteTask } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';
import { addDays, fromIsoDate, today } from '@/lib/dates';
import { useMessages } from '@/lib/i18n/i18n';

/** Tasks as big tiles with icons and stars and little text, for children (ADR 0004). */

interface TileSectionProps {
  heading: string;
  /** What to say when there are no tasks. */
  empty: string;
  tasks: Task[];
}

export function TileSection({ heading, empty, tasks }: TileSectionProps) {
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
            <TaskTile key={task.id} task={task} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** A task as a big tile: its icon, name and points as stars, and a button to mark it done. */
function TaskTile({ task }: { task: Task }) {
  const user = useLoggedInUser();
  const completeTask = useCompleteTask(user.id);
  const t = useMessages().tasks.card;
  const titleId = useId();
  const always = useAlwaysTaskState(task);

  return (
    <li aria-labelledby={titleId}>
      <TaskSwipeToDelete
        task={task}
        currentUserId={user.id}
        className={`rounded-2xl ${always.kind === 'ready' ? 'shadow-card' : ''}`}
        contentClassName={`flex items-center gap-4 p-4 ${always.kind === 'ready' ? 'bg-surface' : 'bg-done-100'}`}
      >
        <TaskTypeIcon type={task.type} icon={task.icon} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 id={titleId} className="text-ink text-lg leading-snug font-bold break-words">
            {task.title}
          </h3>
          <PointsAsStars task={task} />
          <div className="-my-2 -ml-1 w-fit">
            <EditLink task={task} currentUserId={user.id} />
          </div>
          {completeTask.isError && (
            <p role="alert" className="text-danger-700 text-xs">
              {t.failures.complete}
            </p>
          )}
        </div>
        <MarkDoneButton
          title={task.title}
          state={always}
          isPending={completeTask.isPending}
          onClick={() => {
            completeTask.mutate(task);
          }}
        />
      </TaskSwipeToDelete>
    </li>
  );
}

/** When an always task can next be done: once its pause is over, or tomorrow once done for today. */
function changesAt(state: AlwaysTaskState): number | null {
  if (state.kind === 'resting') return state.until;
  if (state.kind === 'doneForToday') return fromIsoDate(addDays(today(), 1)).getTime();
  return null;
}

/**
 * Where an always task stands (`alwaysTaskState()`), rendering again when that changes.
 */
function useAlwaysTaskState(task: Task): AlwaysTaskState {
  const [now, setNow] = useState(() => Date.now());
  const state = alwaysTaskState(task, now, today());
  const until = changesAt(state);
  useEffect(() => {
    if (until === null) return;
    const timer = setTimeout(() => {
      setNow(Date.now());
    }, until - Date.now());
    return () => {
      clearTimeout(timer);
    };
  }, [until]);
  return state;
}

interface MarkDoneButtonProps {
  title: string;
  /** An always task that can't be done now shows it is done instead. */
  state: AlwaysTaskState;
  isPending: boolean;
  onClick: () => void;
}

/** A round check mark to mark the task done, or a filled one while an always task can't be done again yet. */
function MarkDoneButton({ title, state, isPending, onClick }: MarkDoneButtonProps) {
  const t = useMessages().tasks.card;
  if (state.kind !== 'ready') return <DoneForNow state={state} title={title} />;
  return (
    <button
      type="button"
      aria-label={`${t.markDone}: ${title}`}
      disabled={isPending}
      onClick={onClick}
      className="border-brand-600 text-brand-700 hover:bg-brand-50 flex size-14 shrink-0 items-center justify-center rounded-full border-2 disabled:opacity-60"
    >
      <CheckIcon className="size-7" strokeWidth={3} />
    </button>
  );
}

/**
 * Shows an always task is done for now in place of its button: a filled check mark, ringed while its pause runs out.
 */
function DoneForNow({ state, title }: { state: AlwaysTaskState; title: string }) {
  const t = useMessages().tasks.card;
  return (
    <span
      role="img"
      aria-label={`${t.doneForNow}: ${title}`}
      className="bg-done-600 relative flex size-14 shrink-0 items-center justify-center rounded-full text-white"
    >
      {state.kind === 'resting' && <PauseRing key={state.until} until={state.until} />}
      <CheckIcon className="size-7" strokeWidth={3} />
    </span>
  );
}

/** A ring draining until `until`, when an always task's pause is over. */
function PauseRing({ until }: { until: number }) {
  // Read once when the ring appears; the animation runs on from there.
  const [remainingMs] = useState(() => Math.max(until - Date.now(), 0));
  return (
    <svg aria-hidden="true" viewBox="0 0 56 56" className="absolute inset-0 -rotate-90">
      <circle
        cx="28"
        cy="28"
        r="25"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeWidth="4"
        pathLength={100}
        strokeDasharray="100"
        className="animate-ring-drain motion-reduce:animate-none"
        style={{ animationDuration: `${String(remainingMs)}ms` }}
      />
    </svg>
  );
}

/**
 * One star per point, named in words. A private task earns none, and a child's own shared task waits for an
 * adult to choose its points. A task with 0 points shows nothing.
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
  if (isWithoutPoints(task)) return null;
  return (
    <span role="img" aria-label={common.points(task.points)} className="flex flex-wrap gap-0.5">
      {Array.from({ length: task.points }, (_, index) => (
        <StarIcon key={index} className="text-points-600 size-5 fill-current" />
      ))}
    </span>
  );
}
