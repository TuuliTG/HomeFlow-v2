import { useId } from 'react';

import { describeDueDate, today } from '@/features/tasks/dueDate';
import { repeatLabel, type Task, taskTypeLabels } from '@/features/tasks/task';
import { useCompleteTask } from '@/features/tasks/useTasks';

interface TaskCardProps {
  task: Task;
  currentUserId: string;
}

function creatorLabel({ createdBy, creatorName }: Task, currentUserId: string): string {
  if (createdBy === currentUserId) return 'you';
  // No name: they haven't chosen one yet, or have deleted their account.
  return creatorName ?? 'someone';
}

const tagClassName = 'w-fit rounded-full px-2 py-0.5 text-xs font-medium';

export function TaskCard({ task, currentUserId }: TaskCardProps) {
  const titleId = useId();
  const completeTask = useCompleteTask(currentUserId);
  const isPlanning = task.type === 'planning';

  return (
    <li
      aria-labelledby={titleId}
      className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className="font-semibold text-slate-900">
          {task.title}
        </h2>
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
        <span className="text-xs text-slate-500">Added by {creatorLabel(task, currentUserId)}</span>
        {completeTask.isError && (
          <p role="alert" className="text-xs text-red-700">
            We couldn&apos;t mark the task done. Try again.
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-brand-900 text-sm font-semibold">{task.points} points</span>
        <button
          type="button"
          aria-label={`Mark done: ${task.title}`}
          disabled={completeTask.isPending}
          onClick={() => {
            completeTask.mutate(task.id);
          }}
          className="border-brand-600 text-brand-900 hover:bg-brand-50 rounded-lg border px-3 py-1.5 text-sm font-semibold disabled:opacity-60"
        >
          Mark done
        </button>
      </div>
    </li>
  );
}
