import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { paths } from '@/app/paths';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import type { Task } from '@/features/tasks/task';
import { TaskForm } from '@/features/tasks/TaskForm';
import { useDeleteTask, useTasks, useUpdateTask } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

export function EditTaskPage() {
  const user = useLoggedInUser();
  const { taskId } = useParams();
  const tasks = useTasks(user.id);
  const task = tasks.data?.find((candidate) => candidate.id === taskId);
  const t = useMessages();

  return (
    <>
      <PageHeader
        eyebrow={t.tasks.eyebrow}
        title={t.taskForm.edit.title}
        description={t.taskForm.edit.description}
      />
      {task ? (
        <EditTask task={task} userId={user.id} />
      ) : tasks.isPending ? (
        <LoadingMessage />
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          {t.taskForm.edit.notOnBoard}{' '}
          <Link to={paths.tasks} className="text-brand-900 font-semibold underline">
            {t.taskForm.edit.backToTasks}
          </Link>
        </p>
      )}
    </>
  );
}

function EditTask({ task, userId }: { task: Task; userId: string }) {
  const updateTask = useUpdateTask(userId);
  const navigate = useNavigate();
  const t = useMessages();

  return (
    <div className="flex flex-col gap-8">
      <TaskForm
        initial={task}
        submitLabel={t.taskForm.edit.submit}
        isSaving={updateTask.isPending}
        onSave={async (changed) => {
          await updateTask.mutateAsync({ taskId: task.id, task: changed });
          await navigate(paths.taskList(changed.isPrivate));
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
  const { common, taskForm } = useMessages();
  const t = taskForm.edit;

  if (!isConfirming) {
    return (
      <button
        type="button"
        onClick={() => {
          setIsConfirming(true);
        }}
        className="w-fit rounded-lg border border-red-300 px-4 py-2.5 font-semibold text-red-700 hover:bg-red-50"
      >
        {t.delete}
      </button>
    );
  }
  return (
    <section
      aria-label={t.delete}
      className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4"
    >
      <p className="text-sm text-red-900">{t.confirmDelete(task.title)}</p>
      {deleteTask.isError && (
        <p role="alert" className="text-sm text-red-700">
          {t.deleteFailed}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={deleteTask.isPending}
          onClick={() => {
            deleteTask.mutate(task.id, {
              onSuccess: () => void navigate(paths.taskList(task.isPrivate)),
            });
          }}
          className="rounded-lg bg-red-700 px-4 py-2.5 font-semibold text-white hover:bg-red-900 disabled:opacity-60"
        >
          {common.yesDelete}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsConfirming(false);
          }}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-100"
        >
          {common.keepIt}
        </button>
      </div>
    </section>
  );
}
