import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { paths } from '@/app/paths';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import type { Task } from '@/features/tasks/task';
import { TaskForm } from '@/features/tasks/TaskForm';
import { useDeleteTask, useTasks, useUpdateTask } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';

export function EditTaskPage() {
  const user = useLoggedInUser();
  const { taskId } = useParams();
  const tasks = useTasks(user.id);
  const task = tasks.data?.find((candidate) => candidate.id === taskId);

  return (
    <>
      <PageHeader
        eyebrow="Tasks"
        title="Edit task"
        description="Fix the details of an open task."
      />
      {task ? (
        <EditTask task={task} userId={user.id} />
      ) : tasks.isPending ? (
        <LoadingMessage />
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          This task isn&apos;t on the board any more: it may have been done or deleted.{' '}
          <Link to={paths.tasks} className="text-brand-900 font-semibold underline">
            Back to the tasks
          </Link>
        </p>
      )}
    </>
  );
}

function EditTask({ task, userId }: { task: Task; userId: string }) {
  const updateTask = useUpdateTask(userId);
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-8">
      <TaskForm
        initial={task}
        submitLabel="Save changes"
        isSaving={updateTask.isPending}
        onSave={async (changed) => {
          await updateTask.mutateAsync({ taskId: task.id, task: changed });
          await navigate(paths.tasks);
        }}
      />
      <DeleteTask task={task} userId={userId} />
    </div>
  );
}

/** Deleting asks for confirmation first, since it can't be undone. */
function DeleteTask({ task, userId }: { task: Task; userId: string }) {
  const deleteTask = useDeleteTask(userId);
  const navigate = useNavigate();
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isConfirming) {
    return (
      <button
        type="button"
        onClick={() => {
          setIsConfirming(true);
        }}
        className="w-fit rounded-lg border border-red-300 px-4 py-2.5 font-semibold text-red-700 hover:bg-red-50"
      >
        Delete task
      </button>
    );
  }
  return (
    <section
      aria-label="Delete task"
      className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4"
    >
      <p className="text-sm text-red-900">
        Delete &ldquo;{task.title}&rdquo; for everyone in the household? This can&apos;t be undone.
      </p>
      {deleteTask.isError && (
        <p role="alert" className="text-sm text-red-700">
          We couldn&apos;t delete the task. Try again.
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={deleteTask.isPending}
          onClick={() => {
            deleteTask.mutate(task.id, { onSuccess: () => void navigate(paths.tasks) });
          }}
          className="rounded-lg bg-red-700 px-4 py-2.5 font-semibold text-white hover:bg-red-900 disabled:opacity-60"
        >
          Yes, delete
        </button>
        <button
          type="button"
          onClick={() => {
            setIsConfirming(false);
          }}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-100"
        >
          Keep it
        </button>
      </div>
    </section>
  );
}
