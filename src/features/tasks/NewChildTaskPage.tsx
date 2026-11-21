import { useLocation, useNavigate, useParams } from 'react-router';

import { paths } from '@/app/paths';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { ChildTaskForm } from '@/features/tasks/ChildTaskForm';
import { isFromBoardState } from '@/features/tasks/childTasks';
import { ImagesNotSavedError, imagesNotSavedState } from '@/features/tasks/taskImages';
import { useHouseholdMembers } from '@/features/tasks/useHelpers';
import { useAddTask, useMembership } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

/**
 * Adds a task for one child, and goes back where it was opened from: their page (`paths.member`), or the board's
 * children's tasks when the board's New task form opened it (`fromBoardState`).
 */
export function NewChildTaskPage() {
  const { childId = '' } = useParams();
  const user = useLoggedInUser();
  const members = useHouseholdMembers(user.id);
  const householdId = useMembership(user.id).data?.householdId ?? '';
  const addTask = useAddTask(user.id);
  const navigate = useNavigate();
  const returnTo = isFromBoardState(useLocation().state)
    ? paths.taskList({ isPrivate: false, forChildren: true })
    : paths.member(childId);
  const t = useMessages();

  if (members.data === undefined) {
    if (!members.isError) return <LoadingMessage />;
    return (
      <p role="alert" className="text-danger-700 text-sm">
        {t.tasks.me.loadFailed}
      </p>
    );
  }
  const child = members.data.find((member) => member.id === childId && member.isChild);
  if (!child) return <p className="text-ink-muted text-sm">{t.tasks.childTasks.notFound}</p>;

  return (
    <>
      <PageHeader title={t.tasks.childTasks.newTitle(child.name ?? t.common.someone)} />
      <ChildTaskForm
        childId={childId}
        currentUserId={user.id}
        cancelTo={returnTo}
        isSaving={addTask.isPending}
        onSave={async (task, images) => {
          try {
            await addTask.mutateAsync({ task, images, householdId });
          } catch (error) {
            if (!(error instanceof ImagesNotSavedError)) throw error;
            // The task was added: adding its pictures again on the edit page doesn't add it twice.
            await navigate(paths.editTask(error.taskId), { state: imagesNotSavedState });
            return;
          }
          await navigate(returnTo);
        }}
      />
    </>
  );
}
