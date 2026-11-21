import { useNavigate, useParams } from 'react-router';

import { paths } from '@/app/paths';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { ChildTaskForm } from '@/features/tasks/ChildTaskForm';
import { useHouseholdMembers } from '@/features/tasks/useHelpers';
import { useAddTask, useMembership } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

/** Adds a task for one child from their page (`ChildTasksPage`), and goes back there. */
export function NewChildTaskPage() {
  const { childId = '' } = useParams();
  const user = useLoggedInUser();
  const members = useHouseholdMembers(user.id);
  const householdId = useMembership(user.id).data?.householdId ?? '';
  const addTask = useAddTask(user.id);
  const navigate = useNavigate();
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
        cancelTo={paths.member(childId)}
        isSaving={addTask.isPending}
        onSave={async (task) => {
          await addTask.mutateAsync({ task, images: [], householdId, alsoFor: [] });
          await navigate(paths.member(childId));
        }}
      />
    </>
  );
}
