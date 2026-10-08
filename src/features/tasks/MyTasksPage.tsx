import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatShortDate } from '@/features/tasks/dueDate';
import { TaskCard } from '@/features/tasks/TaskCard';
import { useCompletedTasks, useTasks } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';

const emptyClassName =
  'rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600';

export function MyTasksPage() {
  return (
    <>
      <PageHeader
        eyebrow="Me"
        title="My tasks"
        description="Things you've picked up and completed."
      />
      <div className="flex flex-col gap-8">
        <section aria-labelledby="to-do-heading" className="flex flex-col gap-3">
          <h2 id="to-do-heading" className="text-lg font-semibold text-slate-900">
            To do
          </h2>
          <ToDoList />
        </section>
        <section aria-labelledby="completed-heading" className="flex flex-col gap-3">
          <h2 id="completed-heading" className="text-lg font-semibold text-slate-900">
            Completed
          </h2>
          <CompletedList />
        </section>
      </div>
    </>
  );
}

function ToDoList() {
  const user = useLoggedInUser();
  const tasks = useTasks(user.id);

  // A failed refresh keeps showing the tasks already loaded.
  if (tasks.data === undefined) {
    if (!tasks.isError) return <LoadingMessage />;
    return (
      <p role="alert" className="text-sm text-red-700">
        We couldn&apos;t load your tasks. Check your connection and reload the page.
      </p>
    );
  }
  const mine = tasks.data.filter((task) => task.pickedUpBy === user.id);
  if (mine.length === 0) {
    return <p className={emptyClassName}>Nothing picked up yet. Pick a task on the board.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {mine.map((task) => (
        <TaskCard key={task.id} task={task} currentUserId={user.id} />
      ))}
    </ul>
  );
}

function CompletedList() {
  const user = useLoggedInUser();
  const completed = useCompletedTasks(user.id);

  if (completed.isPending) return <LoadingMessage />;
  if (completed.isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        We couldn&apos;t load your completed tasks. Check your connection and reload the page.
      </p>
    );
  }
  if (completed.data.length === 0) {
    return <p className={emptyClassName}>Tasks you mark done will show up here.</p>;
  }
  return (
    <ul
      aria-label="Completed tasks"
      className="flex flex-col divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white"
    >
      {completed.data.map((task) => (
        <li key={task.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
          <span className="font-medium text-slate-900">{task.title}</span>
          <span className="shrink-0 text-slate-500">
            Done {formatShortDate(new Date(task.completedAt))} · {task.points} points
          </span>
        </li>
      ))}
    </ul>
  );
}
