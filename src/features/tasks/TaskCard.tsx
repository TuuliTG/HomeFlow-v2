import { useId } from 'react';

import { type Task, taskTypeLabels } from '@/features/tasks/task';

interface TaskCardProps {
  task: Task;
  currentUserId: string;
}

function creatorLabel({ createdBy, creatorName }: Task, currentUserId: string): string {
  if (createdBy === currentUserId) return 'you';
  // No name: they haven't chosen one yet, or have deleted their account.
  return creatorName ?? 'someone';
}

export function TaskCard({ task, currentUserId }: TaskCardProps) {
  const titleId = useId();
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
        <span
          className={[
            'w-fit rounded-full px-2 py-0.5 text-xs font-medium',
            isPlanning ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700',
          ].join(' ')}
        >
          {taskTypeLabels[task.type]}
        </span>
        <span className="text-xs text-slate-500">Added by {creatorLabel(task, currentUserId)}</span>
      </div>
      <span className="text-brand-900 shrink-0 text-sm font-semibold">{task.points} points</span>
    </li>
  );
}
