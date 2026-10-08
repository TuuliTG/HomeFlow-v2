import { useId } from 'react';
import { Link } from 'react-router';

import { paths } from '@/app/paths';

import { describeDueDate, today } from '@/features/tasks/dueDate';
import { repeatLabel, type Task, taskTypeLabels } from '@/features/tasks/task';
import { useCompleteTask, usePickUpTask, usePutBackTask } from '@/features/tasks/useTasks';

interface TaskCardProps {
  task: Task;
  currentUserId: string;
}

/** "you", their name, or "someone" if they haven't chosen a name or have deleted their account. */
function personLabel(userId: string | null, name: string | null, currentUserId: string): string {
  if (userId === currentUserId) return 'you';
  return name ?? 'someone';
}

const tagClassName = 'w-fit rounded-full px-2 py-0.5 text-xs font-medium';

export function TaskCard({ task, currentUserId }: TaskCardProps) {
  const titleId = useId();

  return (
    <li
      aria-labelledby={titleId}
      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4"
    >
      <div className="flex items-start justify-between gap-4">
        <TaskDetails task={task} currentUserId={currentUserId} titleId={titleId} />
        <span className="text-brand-900 shrink-0 text-sm font-semibold">{task.points} points</span>
      </div>
      <TaskActions task={task} currentUserId={currentUserId} />
    </li>
  );
}

function TaskDetails({ task, currentUserId, titleId }: TaskCardProps & { titleId: string }) {
  const isPlanning = task.type === 'planning';
  return (
    <div className="flex flex-col gap-1">
      <h2 id={titleId} className="font-semibold text-slate-900">
        {task.title}
      </h2>
      {task.description !== null && (
        <p className="text-sm whitespace-pre-line text-slate-600">{task.description}</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        <span
          className={[
            tagClassName,
            isPlanning ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700',
          ].join(' ')}
        >
          {taskTypeLabels[task.type]}
        </span>
        {task.repeatEveryDays !== null && (
          <span className={`${tagClassName} bg-sky-100 text-sky-800`}>
            {repeatLabel(task.repeatEveryDays)}
          </span>
        )}
      </div>
      {task.dueOn !== null && (
        <span className="text-xs font-medium text-slate-700">
          {describeDueDate(task.dueOn, today())}
        </span>
      )}
      <span className="text-xs text-slate-500">
        Added by {personLabel(task.createdBy, task.creatorName, currentUserId)}
      </span>
      {task.pickedUpBy !== null && (
        <span className="text-brand-900 text-xs font-medium">
          Picked up by {personLabel(task.pickedUpBy, task.pickerName, currentUserId)}
        </span>
      )}
    </div>
  );
}

/** Pick up (or put back, if it's yours) and Mark done, with a message when one fails. */
function TaskActions({ task, currentUserId }: TaskCardProps) {
  const completeTask = useCompleteTask(currentUserId);
  const pickUpTask = usePickUpTask(currentUserId);
  const putBackTask = usePutBackTask(currentUserId);
  const isBusy = completeTask.isPending || pickUpTask.isPending || putBackTask.isPending;
  const failure = [
    completeTask.isError && "We couldn't mark the task done. Try again.",
    pickUpTask.isError && "We couldn't pick up the task. Someone may have taken it first.",
    putBackTask.isError && "We couldn't put the task back. Try again.",
  ].find(Boolean);

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

  return (
    <>
      {failure && (
        <p role="alert" className="text-xs text-red-700">
          {failure}
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        <Link
          to={paths.editTask(task.id)}
          aria-label={`Edit: ${task.title}`}
          className="text-brand-900 mr-auto rounded-lg px-1 py-1.5 text-sm font-semibold underline-offset-2 hover:underline"
        >
          Edit
        </Link>
        {task.pickedUpBy === currentUserId &&
          button(
            'Put back',
            () => {
              putBackTask.mutate(task.id);
            },
            'border-slate-300 text-slate-700 hover:bg-slate-100',
          )}
        {task.pickedUpBy === null &&
          button(
            'Pick up',
            () => {
              pickUpTask.mutate(task.id);
            },
            'border-brand-600 text-brand-900 hover:bg-brand-50',
          )}
        {button(
          'Mark done',
          () => {
            completeTask.mutate(task.id);
          },
          'border-brand-600 bg-brand-600 hover:bg-brand-900 text-white',
        )}
      </div>
    </>
  );
}
