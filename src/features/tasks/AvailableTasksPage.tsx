import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { TaskCard } from '@/features/tasks/TaskCard';
import { useTasks } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';

export function AvailableTasksPage() {
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
      <TaskList />
    </>
  );
}

function TaskList() {
  const user = useLoggedInUser();
  const tasks = useTasks(user.id);

  // A failed refresh keeps showing the tasks already loaded.
  if (tasks.data === undefined) {
    if (!tasks.isError) return <LoadingMessage />;
    return (
      <p role="alert" className="text-sm text-red-700">
        We couldn&apos;t load the tasks. Check your connection and reload the page.
      </p>
    );
  }
  if (tasks.data.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
        No tasks yet. Create the first one!
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {tasks.data.map((task) => (
        <TaskCard key={task.id} task={task} currentUserId={user.id} />
      ))}
    </ul>
  );
}
