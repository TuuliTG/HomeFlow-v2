import { type ReactNode, useCallback, useId, useState } from 'react';

import { StarIcon } from '@/components/ui/icons';
import { type Messages, useMessages } from '@/lib/i18n/i18n';
import { isToDoBy, type Task } from '@/features/tasks/task';
import { AskLink, EditLink } from '@/features/tasks/TaskCardLinks';
import { TaskFavouriteStar } from '@/features/tasks/TaskFavouriteStar';
import { TaskImages } from '@/features/tasks/TaskImages';
import { TaskPeople } from '@/features/tasks/TaskPeople';
import { TaskReminder } from '@/features/tasks/TaskReminder';
import { TaskRequestPanel } from '@/features/tasks/TaskRequestPanel';
import { TaskTags } from '@/features/tasks/TaskTags';
import { TaskTypeIcon } from '@/components/ui/TaskTypeIcon';
import { useCompleteTask, usePickUpTask, usePutBackTask } from '@/features/tasks/useTasks';

interface TaskCardProps {
  task: Task;
  currentUserId: string;
  /** Heading level of the task's title, one below the heading of the list it is in. */
  titleLevel: 3 | 4;
  /** An item in a list of tasks, or a panel on its own, which takes focus when it opens. */
  as?: 'li' | 'section';
  /** More about the task, below its actions. */
  children?: ReactNode;
}

export function TaskCard({
  task,
  currentUserId,
  titleLevel,
  as: Root = 'li',
  children,
}: TaskCardProps) {
  const titleId = useId();
  const t = useMessages();
  const isPanel = Root === 'section';
  const focusWhenOpened = useCallback((element: HTMLElement | null) => {
    element?.focus();
  }, []);

  return (
    <Root
      ref={isPanel ? focusWhenOpened : undefined}
      aria-labelledby={titleId}
      tabIndex={isPanel ? -1 : undefined}
      className="bg-surface shadow-card flex flex-col gap-3 rounded-2xl p-4"
    >
      <div className="flex items-start gap-3">
        <TaskTypeIcon type={task.type} icon={task.icon} />
        <TaskDetails
          task={task}
          currentUserId={currentUserId}
          titleId={titleId}
          titleLevel={titleLevel}
        />
        <div className="-mt-2 -mr-2 ml-auto flex shrink-0 items-center gap-1">
          {task.points !== null && (
            <span className="bg-points-100 text-points-800 flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-extrabold whitespace-nowrap">
              <StarIcon className="size-4 fill-current" />
              {t.common.points(task.points)}
            </span>
          )}
          <TaskFavouriteStar title={task.title} currentUserId={currentUserId} />
        </div>
      </div>
      <TaskImages paths={task.images} title={task.title} currentUserId={currentUserId} />
      {isToDoBy(task, currentUserId) && <TaskReminder task={task} currentUserId={currentUserId} />}
      <TaskRequestPanel task={task} currentUserId={currentUserId} />
      <TaskActions task={task} currentUserId={currentUserId} />
      {children}
    </Root>
  );
}

function TaskDetails({
  task,
  currentUserId,
  titleId,
  titleLevel,
}: Pick<TaskCardProps, 'task' | 'currentUserId' | 'titleLevel'> & { titleId: string }) {
  const Title = titleLevel === 3 ? 'h3' : 'h4';
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Title id={titleId} className="text-ink text-[1.0625rem] leading-snug font-bold">
        {task.title}
      </Title>
      {task.description !== null && (
        <p className="text-ink-muted text-sm whitespace-pre-line">{task.description}</p>
      )}
      <TaskTags task={task} />
      <TaskPeople task={task} currentUserId={currentUserId} />
    </div>
  );
}

type Action = keyof Messages['tasks']['card']['failures'];

/** The action that failed first, if any. */
function failedAction(failed: Record<Action, boolean>): Action | undefined {
  return (['complete', 'pickUp', 'putBack'] as const).find((action) => failed[action]);
}

/**
 * Whether the user can pick the task up or put it back. A private task is already the user's own, and
 * a task given to a child is theirs alone, so neither applies.
 */
function pickUpAction(task: Task, currentUserId: string): 'pickUp' | 'putBack' | null {
  if (task.isPrivate || task.assignedTo !== null) return null;
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
        className={`min-h-11 flex-1 rounded-xl px-4 text-[0.9375rem] font-bold disabled:opacity-60 md:flex-none ${className}`}
      >
        {label}
      </button>
    );
  }

  function markDone() {
    setIsConfirming(false);
    completeTask.mutate(task);
  }

  return (
    <>
      {failure && (
        <p role="alert" className="text-danger-700 text-xs">
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
          <div className="mr-auto flex gap-1">
            <EditLink task={task} currentUserId={currentUserId} />
            <AskLink task={task} currentUserId={currentUserId} />
          </div>
          {pickUp === 'putBack' &&
            button(
              t.putBack,
              () => {
                putBackTask.mutate(task.id);
              },
              'bg-page text-ink hover:bg-line',
            )}
          {pickUp === 'pickUp' &&
            button(
              t.pickUp,
              () => {
                pickUpTask.mutate(task.id);
              },
              'bg-brand-50 text-brand-900 hover:bg-brand-100',
            )}
          {button(
            t.markDone,
            () => {
              // Taking over someone else's task is allowed, but shouldn't happen by accident.
              if (isSomeoneElses) setIsConfirming(true);
              else markDone();
            },
            'bg-brand-700 hover:bg-brand-900 text-white',
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
      className="bg-notice-50 text-notice-900 flex flex-col gap-2 rounded-xl p-3 text-sm"
    >
      <p>{t.tasks.card.confirmTakeOver(pickerName)}</p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="bg-surface text-ink hover:bg-page min-h-11 rounded-xl px-4 font-bold"
        >
          {t.common.cancel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="bg-brand-700 hover:bg-brand-900 min-h-11 rounded-xl px-4 font-bold text-white"
        >
          {t.tasks.card.yesIDidIt}
        </button>
      </div>
    </div>
  );
}
