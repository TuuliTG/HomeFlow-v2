import type { Task } from '@/features/tasks/task';
import { TaskDueDate } from '@/features/tasks/TaskDueDate';
import { type Messages, useMessages } from '@/lib/i18n/i18n';

const tagClassName = 'w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold';

interface Tag {
  label: string;
  className: string;
}

/** The tags a task's card shows: its type, then whatever else applies to it. */
function tagsOf(task: Task, t: Messages): Tag[] {
  const shared = !task.isPrivate;
  const tags: (Tag | false)[] = [
    {
      label: t.common.taskTypes[task.type],
      className: task.type === 'meta' ? 'bg-meta-100 text-meta-800' : 'bg-brand-100 text-brand-900',
    },
    task.isPrivate && { label: t.tasks.card.private, className: 'bg-amber-100 text-amber-900' },
    shared &&
      task.forChildren && {
        label: t.tasks.card.forChildren,
        className: 'bg-emerald-100 text-emerald-800',
      },
    shared &&
      task.points === null && {
        label: t.tasks.card.waitingForPoints,
        className: 'bg-amber-100 text-amber-900',
      },
    task.repeatEveryDays !== null && {
      label: t.tasks.repeat(task.repeatEveryDays),
      className: 'bg-sky-100 text-sky-800',
    },
  ];
  return tags.filter((tag): tag is Tag => tag !== false);
}

/** When the task is due, then its tags. */
export function TaskTags({ task }: { task: Task }) {
  const t = useMessages();
  return (
    <div className="flex flex-wrap gap-1.5">
      {task.dueOn !== null && <TaskDueDate dueOn={task.dueOn} />}
      {tagsOf(task, t).map(({ label, className }) => (
        <span key={label} className={`${tagClassName} ${className}`}>
          {label}
        </span>
      ))}
    </div>
  );
}
