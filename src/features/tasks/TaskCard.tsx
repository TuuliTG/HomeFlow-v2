import { useId, useState } from 'react';
import { Link } from 'react-router';

import { paths } from '@/app/paths';

import { describeDueDate } from '@/features/tasks/dueDate';
import { today } from '@/lib/dates';
import { type Messages, useMessages } from '@/lib/i18n/i18n';
import { isToDoBy, type Task } from '@/features/tasks/task';
import { TaskFavouriteStar } from '@/features/tasks/TaskFavouriteStar';
import { TaskReminder } from '@/features/tasks/TaskReminder';
import { useCompleteTask, usePickUpTask, usePutBackTask } from '@/features/tasks/useTasks';

interface TaskCardProps {
  task: Task;
  currentUserId: string;
  /** Heading level of the task's title, one below the heading of the list it is in. */
  titleLevel: 3 | 4;
}

type ByPerson = Messages['tasks']['card']['addedBy'];

/** "Added by you", by their name, or by "someone" if they haven't chosen a name or have deleted their account. */
function byPerson(
  phrases: ByPerson,
  person: { userId: string | null; name: string | null },
  currentUserId: string,
): string {
  if (person.userId === currentUserId) return phrases.you;
  return person.name === null ? phrases.someone : phrases.named(person.name);
}

const tagClassName = 'w-fit rounded-full px-2 py-0.5 text-xs font-medium';

export function TaskCard({ task, currentUserId, titleLevel }: TaskCardProps) {
  const titleId = useId();
  const t = useMessages();

  return (
    <li
      aria-labelledby={titleId}
      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <TaskDetails
          task={task}
          currentUserId={currentUserId}
          titleId={titleId}
          titleLevel={titleLevel}
        />
        <div className="-mt-2 -mr-2 flex shrink-0 items-center gap-1">
          {task.points !== null && (
            <span className="text-brand-900 text-sm font-semibold">
              {t.common.points(task.points)}
            </span>
          )}
          <TaskFavouriteStar title={task.title} currentUserId={currentUserId} />
        </div>
      </div>
      {isToDoBy(task, currentUserId) && <TaskReminder task={task} currentUserId={currentUserId} />}
      <TaskActions task={task} currentUserId={currentUserId} />
    </li>
  );
}

function TaskDetails({
  task,
  currentUserId,
  titleId,
  titleLevel,
}: TaskCardProps & { titleId: string }) {
  const isMeta = task.type === 'meta';
  const t = useMessages();
  const Title = titleLevel === 3 ? 'h3' : 'h4';
  return (
    <div className="flex flex-col gap-1">
      <Title id={titleId} className="font-semibold text-slate-900">
        {task.title}
      </Title>
      {task.description !== null && (
        <p className="text-sm whitespace-pre-line text-slate-600">{task.description}</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        <span
          className={[
            tagClassName,
            isMeta ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700',
          ].join(' ')}
        >
          {t.common.taskTypes[task.type]}
        </span>
        {task.isPrivate && (
          <span className={`${tagClassName} bg-amber-100 text-amber-900`}>
            {t.tasks.card.private}
          </span>
        )}
        {task.repeatEveryDays !== null && (
          <span className={`${tagClassName} bg-sky-100 text-sky-800`}>
            {t.tasks.repeat(task.repeatEveryDays)}
          </span>
        )}
      </div>
      {task.dueOn !== null && (
        <span className="text-xs font-medium text-slate-700">
          {describeDueDate(task.dueOn, today(), t)}
        </span>
      )}
      <span className="text-xs text-slate-500">
        {byPerson(
          t.tasks.card.addedBy,
          { userId: task.createdBy, name: task.creatorName },
          currentUserId,
        )}
      </span>
      {task.pickedUpBy !== null && (
        <span className="text-brand-900 text-xs font-medium">
          {byPerson(
            t.tasks.card.pickedUpBy,
            { userId: task.pickedUpBy, name: task.pickerName },
            currentUserId,
          )}
        </span>
      )}
    </div>
  );
}

type Action = keyof Messages['tasks']['card']['failures'];

/** The action that failed first, if any. */
function failedAction(failed: Record<Action, boolean>): Action | undefined {
  return (['complete', 'pickUp', 'putBack'] as const).find((action) => failed[action]);
}

/**
 * Whether the user can pick the task up or put it back. A private task is already the user's own, so
 * neither applies.
 */
function pickUpAction(task: Task, currentUserId: string): 'pickUp' | 'putBack' | null {
  if (task.isPrivate) return null;
  if (task.pickedUpBy === currentUserId) return 'putBack';
  return task.pickedUpBy === null ? 'pickUp' : null;
}

/** Pick up (or put back, if it's yours) and Mark done, with a message when one fails. */
function TaskActions({ task, currentUserId }: Pick<TaskCardProps, 'task' | 'currentUserId'>) {
  const completeTask = useCompleteTask(currentUserId);
  const pickUpTask = usePickUpTask(currentUserId);
  const putBackTask = usePutBackTask(currentUserId);
  const { common, tasks } = useMessages();
  const t = tasks.card;
  const [isConfirming, setIsConfirming] = useState(false);
  const isSomeoneElses = task.pickedUpBy !== null && task.pickedUpBy !== currentUserId;
  const pickUp = pickUpAction(task, currentUserId);
  const isBusy = completeTask.isPending || pickUpTask.isPending || putBackTask.isPending;
  const failure = failedAction({
    complete: completeTask.isError,
    pickUp: pickUpTask.isError,
    putBack: putBackTask.isError,
  });

  function button(label: string, onClick: () => void, className: string) {
    return (
      <button
        type="button"
        aria-label={`${label}: ${task.title}`}
        disabled={isBusy}
        onClick={onClick}
        className={`rounded-lg border px-3 py-1.5 text-sm font-semibold disabled:opacity-60 ${className}`}
      >
        {label}
      </button>
    );
  }

  function markDone() {
    setIsConfirming(false);
    completeTask.mutate(task.id);
  }

  return (
    <>
      {failure && (
        <p role="alert" className="text-xs text-red-700">
          {t.failures[failure]}
        </p>
      )}
      {isConfirming ? (
        <ConfirmTakeOver
          pickerName={task.pickerName ?? common.someone}
          onConfirm={markDone}
          onCancel={() => {
            setIsConfirming(false);
          }}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            to={paths.editTask(task.id)}
            aria-label={`${t.edit}: ${task.title}`}
            className="text-brand-900 mr-auto rounded-lg px-1 py-1.5 text-sm font-semibold underline-offset-2 hover:underline"
          >
            {t.edit}
          </Link>
          {pickUp === 'putBack' &&
            button(
              t.putBack,
              () => {
                putBackTask.mutate(task.id);
              },
              'border-slate-300 text-slate-700 hover:bg-slate-100',
            )}
          {pickUp === 'pickUp' &&
            button(
              t.pickUp,
              () => {
                pickUpTask.mutate(task.id);
              },
              'border-brand-600 text-brand-900 hover:bg-brand-50',
            )}
          {button(
            t.markDone,
            () => {
              // Taking over someone else's task is allowed, but shouldn't happen by accident.
              if (isSomeoneElses) setIsConfirming(true);
              else markDone();
            },
            'border-brand-600 bg-brand-600 hover:bg-brand-900 text-white',
          )}
        </div>
      )}
    </>
  );
}

interface ConfirmTakeOverProps {
  pickerName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Asks before marking done a task another member has picked up. */
function ConfirmTakeOver({ pickerName, onConfirm, onCancel }: ConfirmTakeOverProps) {
  const t = useMessages();
  return (
    <div
      role="group"
      aria-label={t.tasks.card.confirmTakeOverLabel(pickerName)}
      className="flex flex-col gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
    >
      <p>{t.tasks.card.confirmTakeOver(pickerName)}</p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
        >
          {t.common.cancel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="bg-brand-600 hover:bg-brand-900 rounded-lg px-3 py-1.5 font-semibold text-white"
        >
          {t.tasks.card.yesIDidIt}
        </button>
      </div>
    </div>
  );
}
