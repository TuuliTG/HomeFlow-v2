import { useNavigate, useSearchParams } from 'react-router';

import { paths } from '@/app/paths';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { parseToDoView, startFromLink } from '@/features/tasks/schedule';
import { findSuggestion, suggestionAsTask } from '@/features/tasks/suggestions';
import { ImagesNotSavedError, imagesNotSavedState } from '@/features/tasks/taskImages';
import { TaskForm } from '@/features/tasks/TaskForm';
import { taskFromLink } from '@/features/tasks/taskLink';
import { usePlanNewTask } from '@/features/tasks/useSchedules';
import {
  useAddTask,
  useFavouriteTasks,
  useMembership,
  useSetFavouriteTask,
  useTaskSuggestions,
} from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';
import { reportError } from '@/lib/monitoring';

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
        <NewTaskForm
          userId={user.id}
          isChild={membership.data?.isChild ?? false}
          householdId={membership.data?.householdId ?? null}
        />
      )}
    </>
  );
}

interface NewTaskFormProps {
  userId: string;
  isChild: boolean;
  householdId: string | null;
}

function NewTaskForm({ userId, isChild, householdId }: NewTaskFormProps) {
  const addTask = useAddTask(userId);
  const planNewTask = usePlanNewTask(userId);
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
  /** When the task goes in the user's timetable, if they are adding it from there (`paths.newTaskAt`). */
  const startsAt = startFromLink(searchParams);

  if (againTitle !== null && suggestions.isPending) return <LoadingMessage />;
  return (
    <>
      {startsAt !== null && (
        <p className="bg-brand-50 text-brand-900 mb-4 rounded-xl px-4 py-3 text-sm">
          {t.schedule.addingAt(
            t.common.shortDate(new Date(startsAt)),
            t.common.time(new Date(startsAt)),
          )}
        </p>
      )}
      <TaskForm
        prefill={again ? suggestionAsTask(again) : taskFromLink(searchParams)}
        suggestions={suggestions.data ?? []}
        favourites={{
          keys: suggestions.isSuccess ? favourites.data : undefined,
          isSaving: setFavourite.isPending,
          onChange: (title, isFavourite) => {
            setFavourite.mutate({ title, isFavourite });
          },
        }}
        isChild={isChild}
        currentUserId={userId}
        submitLabel={t.taskForm.create.submit}
        isSaving={addTask.isPending || planNewTask.isPending}
        onSave={async (task, images) => {
          let taskId: string;
          try {
            taskId = await addTask.mutateAsync({ task, images, householdId: householdId ?? '' });
          } catch (error) {
            if (!(error instanceof ImagesNotSavedError)) throw error;
            // The task was added: adding its pictures again on the edit page doesn't add it twice.
            await navigate(paths.editTask(error.taskId), { state: imagesNotSavedState });
            return;
          }
          if (startsAt === null) {
            await navigate(paths.taskList(task.isPrivate));
            return;
          }
          try {
            await planNewTask.mutateAsync({ taskId, isPrivate: task.isPrivate, startsAt });
          } catch (error) {
            // The task was added, so the form isn't the place to say so: the user finds it among their
            // tasks (shared ones on the board) and can schedule it again.
            void reportError(error);
          }
          await navigate(paths.meAs(parseToDoView(searchParams.get('view'))));
        }}
      />
    </>
  );
}
