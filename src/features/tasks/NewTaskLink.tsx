import { paths } from '@/app/paths';
import { AddLink } from '@/components/ui/AddLink';
import { useMembership } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

/** To the New task form, for adults and for children an adult lets add tasks. */
export function NewTaskLink() {
  const user = useLoggedInUser();
  const membership = useMembership(user.id);
  const t = useMessages();
  if (membership.data?.canAddTasks !== true) return null;
  return <AddLink to={paths.newTask} label={t.tasks.newTask} />;
}
