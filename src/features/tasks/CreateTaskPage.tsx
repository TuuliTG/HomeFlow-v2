import { useNavigate, useSearchParams } from 'react-router';

import { paths } from '@/app/paths';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { findSuggestion, suggestionAsTask } from '@/features/tasks/suggestions';
import { TaskForm } from '@/features/tasks/TaskForm';
import {
  useAddTask,
  useFavouriteTasks,
  useIsChild,
  useSetFavouriteTask,
  useTaskSuggestions,
} from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

export function CreateTaskPage() {
  const user = useLoggedInUser();
  const addTask = useAddTask(user.id);
  const suggestions = useTaskSuggestions(user.id);
  const favourites = useFavouriteTasks(user.id);
  const isChild = useIsChild(user.id);
  const setFavourite = useSetFavouriteTask(user.id);
  const navigate = useNavigate();
  const t = useMessages();
  const [searchParams] = useSearchParams();
  /** The name of an earlier task to add again (`paths.addTaskAgain`). */
  const againTitle = searchParams.get('again');
  const again =
    againTitle === null ? undefined : findSuggestion(suggestions.data ?? [], againTitle);

  return (
    <>
      <PageHeader
        eyebrow={t.tasks.eyebrow}
        title={t.tasks.newTask}
        description={t.taskForm.create.description}
      />
      {(againTitle !== null && suggestions.isPending) || isChild.isPending ? (
        <LoadingMessage />
      ) : (
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
          isChild={isChild.data ?? false}
          submitLabel={t.taskForm.create.submit}
          isSaving={addTask.isPending}
          onSave={async (task) => {
            await addTask.mutateAsync(task);
            await navigate(paths.taskList(task.isPrivate));
          }}
        />
      )}
    </>
  );
}
