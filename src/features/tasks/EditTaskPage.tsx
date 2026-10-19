import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';

import { paths } from '@/app/paths';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { canChange, type Task } from '@/features/tasks/task';
import { TaskForm } from '@/features/tasks/TaskForm';
import { isImagesNotSavedState } from '@/features/tasks/taskImages';
import { useDeleteTask, useMembership, useTasks, useUpdateTask } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

export function EditTaskPage() {
  const user = useLoggedInUser();
  const { taskId } = useParams();
  const tasks = useTasks(user.id);
  const membership = useMembership(user.id);
  const isChild = membership.data?.isChild ?? false;
  const found = tasks.data?.find((candidate) => candidate.id === taskId);
  // A child reaching an adult's task by its address sees it as unavailable, like the database.
  const task = found && canChange(found, user.id, isChild) ? found : undefined;
  const t = useMessages();

  return (
    <>
      <PageHeader
        eyebrow={t.tasks.eyebrow}
        title={t.taskForm.edit.title}
        description={t.taskForm.edit.description}
      />
      <ImagesNotSavedNotice />
      {task && !membership.isPending ? (
        <EditTask task={task} userId={user.id} isChild={isChild} />
      ) : tasks.isPending || membership.isPending ? (
        <LoadingMessage />
      ) : (
        <p className="border-line-strong bg-surface text-ink-muted rounded-2xl border border-dashed p-6 text-sm">
          {t.taskForm.edit.notOnBoard}{' '}
          <Link to={paths.tasks} className="text-brand-900 font-semibold underline">
            {t.taskForm.edit.backToTasks}
          </Link>
        </p>
      )}
    </>
  );
}

/** After a new task was added without its pictures (`imagesNotSavedState`), asks to add them again. */
function ImagesNotSavedNotice() {
  const t = useMessages().taskForm.edit;
  if (!isImagesNotSavedState(useLocation().state)) return null;
  return (
    <p role="status" className="bg-notice-50 text-notice-900 rounded-xl p-3 text-sm">
      {t.imagesNotSaved}
    </p>
  );
}

function EditTask({ task, userId, isChild }: { task: Task; userId: string; isChild: boolean }) {
  const updateTask = useUpdateTask(userId);
  const householdId = useMembership(userId).data?.householdId ?? '';
  // The pictures the form opened with: live updates may change the task's meanwhile.
  const [imagesBefore] = useState(task.images);
  const navigate = useNavigate();
  const t = useMessages();

  return (
    <div className="flex flex-col gap-8">
      <TaskForm
        initial={task}
        initialImages={imagesBefore}
        isChild={isChild}
        currentUserId={userId}
        submitLabel={t.taskForm.edit.submit}
        isSaving={updateTask.isPending}
        onSave={async (changed, images) => {
          await updateTask.mutateAsync({
            taskId: task.id,
            task: changed,
            images,
            householdId,
            before: imagesBefore,
          });
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
        className="border-danger-300 text-danger-700 hover:bg-danger-50 w-fit rounded-xl border px-4 py-2.5 font-semibold"
      >
        {t.delete}
      </button>
    );
  }
  return (
    <section
      aria-label={t.delete}
      className="border-danger-200 bg-danger-50 flex flex-col gap-3 rounded-2xl border p-4"
    >
      <p className="text-danger-900 text-sm">{t.confirmDelete(task.title)}</p>
      {deleteTask.isError && (
        <p role="alert" className="text-danger-700 text-sm">
          {t.deleteFailed}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={deleteTask.isPending}
          onClick={() => {
            // Not mutate()'s onSuccess: the refetch after deleting removes the task, which unmounts
            // this form before that callback would run. A failure shows through isError.
            deleteTask.mutateAsync(task).then(
              () => navigate(paths.taskList(task.isPrivate)),
              () => undefined,
            );
          }}
          className="bg-danger-700 hover:bg-danger-900 rounded-xl px-4 py-2.5 font-bold text-white disabled:opacity-60"
        >
          {common.yesDelete}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsConfirming(false);
          }}
          className="border-line-strong bg-surface text-ink hover:bg-page rounded-xl border px-4 py-2.5 font-semibold"
        >
          {common.keepIt}
        </button>
      </div>
    </section>
  );
}
