import { useNavigate, useSearchParams } from 'react-router';

import { paths } from '@/app/paths';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { findSuggestion, suggestionAsTask } from '@/features/tasks/suggestions';
import { TaskForm } from '@/features/tasks/TaskForm';
import {
  useAddTask,
  useFavouriteTasks,
  useMembership,
  useSetFavouriteTask,
  useTaskSuggestions,
} from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

export function CreateTaskPage() {
  const user = useLoggedInUser();
  const membership = useMembership(user.id);
  const t = useMessages();

  return (
    <>
      <PageHeader
        eyebrow={t.tasks.eyebrow}
        title={t.tasks.newTask}
        description={t.taskForm.create.description}
      />
      {membership.isPending ? (
        <LoadingMessage />
      ) : membership.data?.canAddTasks === false ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          {t.taskForm.create.askAnAdult}
        </p>
      ) : (
        <NewTaskForm userId={user.id} isChild={membership.data?.isChild ?? false} />
      )}
    </>
  );
}

function NewTaskForm({ userId, isChild }: { userId: string; isChild: boolean }) {
  const addTask = useAddTask(userId);
  const suggestions = useTaskSuggestions(userId);
  const favourites = useFavouriteTasks(userId);
  const setFavourite = useSetFavouriteTask(userId);
  const navigate = useNavigate();
  const t = useMessages();
  const [searchParams] = useSearchParams();
  /** The name of an earlier task to add again (`paths.addTaskAgain`). */
  const againTitle = searchParams.get('again');
  const again =
    againTitle === null ? undefined : findSuggestion(suggestions.data ?? [], againTitle);

  if (againTitle !== null && suggestions.isPending) return <LoadingMessage />;
  return (
    <TaskForm
      prefill={again && suggestionAsTask(again)}
      suggestions={suggestions.data ?? []}
      favourites={{
        keys: suggestions.isSuccess ? favourites.data : undefined,
        isSaving: setFavourite.isPending,
        onChange: (title, isFavourite) => {
          setFavourite.mutate({ title, isFavourite });
        },
      }}
      isChild={isChild}
      submitLabel={t.taskForm.create.submit}
      isSaving={addTask.isPending}
      onSave={async (task) => {
        await addTask.mutateAsync(task);
        await navigate(paths.taskList(task.isPrivate));
      }}
    />
  );
}
