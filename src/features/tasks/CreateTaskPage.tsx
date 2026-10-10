import { useNavigate, useSearchParams } from 'react-router';

import { paths } from '@/app/paths';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { findSuggestion, suggestionAsTask } from '@/features/tasks/suggestions';
import { TaskForm } from '@/features/tasks/TaskForm';
import {
  useAddTask,
  useFavouriteTasks,
  useSetFavouriteTask,
  useTaskSuggestions,
} from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';

export function CreateTaskPage() {
  const user = useLoggedInUser();
  const addTask = useAddTask(user.id);
  const suggestions = useTaskSuggestions(user.id);
  const favourites = useFavouriteTasks(user.id);
  const setFavourite = useSetFavouriteTask(user.id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  /** The name of an earlier task to add again (`paths.addTaskAgain`). */
  const againTitle = searchParams.get('again');
  const again =
    againTitle === null ? undefined : findSuggestion(suggestions.data ?? [], againTitle);

  return (
    <>
      <PageHeader
        eyebrow="Tasks"
        title="New task"
        description="Adding a task is meta work, and it counts."
      />
      {againTitle !== null && suggestions.isPending ? (
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
          submitLabel="Create task"
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
