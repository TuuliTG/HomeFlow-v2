import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { PageHeader } from '@/components/ui/PageHeader';
import { TaskCard } from '@/features/tasks/TaskCard';
import { useTasks } from '@/features/tasks/tasksContext';

export function AvailableTasksPage() {
  const { tasks } = useTasks();

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          eyebrow="Tasks"
          title="Available tasks"
          description="Pick any task. New tasks earn bonus points for variety and fairness."
        />
        <Link
          to={paths.newTask}
          className="bg-brand-600 hover:bg-brand-900 shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-white"
        >
          <span aria-hidden="true">+ </span>New task
        </Link>
      </div>
      {tasks.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          No tasks yet. Create the first one!
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </ul>
      )}
    </>
  );
}
