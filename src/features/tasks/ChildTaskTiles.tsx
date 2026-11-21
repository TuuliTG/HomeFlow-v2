import { type ReactNode, useEffect, useId, useState } from 'react';

import { CheckIcon, StarIcon } from '@/components/ui/icons';
import { emptyClassName, sectionHeadingClassName } from '@/features/tasks/meStyles';
import {
  type AlwaysTaskState,
  alwaysTaskState,
  isWithoutPoints,
  type Task,
} from '@/features/tasks/task';
import { EditLink } from '@/features/tasks/TaskCardLinks';
import { TaskTypeIcon } from '@/components/ui/TaskTypeIcon';
import { useCompleteTask, usePickUpTask } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';
import { addDays, fromIsoDate, today } from '@/lib/dates';
import { useMessages } from '@/lib/i18n/i18n';

/** Tasks as big tiles with icons and stars and little text, for children (ADR 0004). */

type TileAction = 'markDone' | 'pickUp';

interface TileSectionProps {
  heading: string;
  /** What to say when there are no tasks; without it, the section is left out then. */
  empty?: ReactNode;
  tasks: Task[];
  /** The tiles' button, if any. */
  action: TileAction | null;
  /** A line under each tile's stars, e.g. who is doing it. */
  note?: (task: Task) => ReactNode;
}

export function TileSection({ heading, empty, tasks, action, note }: TileSectionProps) {
  const headingId = useId();
  if (tasks.length === 0 && empty === undefined) return null;
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
            <TaskTile key={task.id} task={task} action={action} note={note?.(task)} />
          ))}
        </ul>
      )}
    </section>
  );
}

interface TaskTileProps {
  task: Task;
  action: TileAction | null;
  note: ReactNode;
}

/** A task as a big tile: its icon, name and points as stars, a note, and one button. */
function TaskTile({ task, action, note }: TaskTileProps) {
  const user = useLoggedInUser();
  const completeTask = useCompleteTask(user.id);
  const pickUpTask = usePickUpTask(user.id);
  const t = useMessages().tasks.card;
  const titleId = useId();
  const mutation = action === 'markDone' ? completeTask : pickUpTask;
  const always = useAlwaysTaskState(task);

  return (
    <li
      aria-labelledby={titleId}
      className={`flex items-center gap-4 rounded-2xl p-4 ${always.kind === 'ready' ? 'bg-surface shadow-card' : 'bg-done-100'}`}
    >
      <TaskTypeIcon type={task.type} icon={task.icon} size="lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 id={titleId} className="text-ink text-lg leading-snug font-bold break-words">
          {task.title}
        </h3>
        <PointsAsStars task={task} />
        {note && <p className="text-ink-muted text-sm font-semibold">{note}</p>}
        <div className="-my-2 -ml-1 w-fit">
          <EditLink task={task} currentUserId={user.id} />
        </div>
        {mutation.isError && (
          <p role="alert" className="text-danger-700 text-xs">
            {t.failures[action === 'markDone' ? 'complete' : 'pickUp']}
          </p>
        )}
      </div>
      {action === 'markDone' && (
        <MarkDoneButton
          title={task.title}
          state={always}
          isPending={mutation.isPending}
          onClick={() => {
            completeTask.mutate(task);
          }}
        />
      )}
      {action === 'pickUp' && (
        <PickUpButton
          title={task.title}
          state={always}
          isPending={mutation.isPending}
          onClick={() => {
            pickUpTask.mutate(task.id);
          }}
        />
      )}
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

/** Picks a free task up, unless it is an always task that was just done. */
function PickUpButton({ title, state, isPending, onClick }: MarkDoneButtonProps) {
  const t = useMessages().tasks.card;
  if (state.kind !== 'ready') return <DoneForNow state={state} title={title} />;
  return (
    <button
      type="button"
      aria-label={`${t.pickUp}: ${title}`}
      disabled={isPending}
      onClick={onClick}
      className="bg-brand-700 hover:bg-brand-900 min-h-11 shrink-0 rounded-xl px-4 text-[0.9375rem] font-bold text-white disabled:opacity-60"
    >
      {t.pickUp}
    </button>
  );
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
