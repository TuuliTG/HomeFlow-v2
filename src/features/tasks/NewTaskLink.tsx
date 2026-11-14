import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { PlusIcon } from '@/components/ui/icons';
import { useMembership } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

/** To the New task form, for adults and for children an adult lets add tasks. */
export function NewTaskLink() {
  const user = useLoggedInUser();
  const membership = useMembership(user.id);
  const t = useMessages();
  if (membership.data?.canAddTasks !== true) return null;
  return (
    <Link
      to={paths.newTask}
      aria-label={t.tasks.newTask}
      title={t.tasks.newTask}
      className="bg-brand-700 hover:bg-brand-900 flex size-11 shrink-0 items-center justify-center rounded-full text-white"
    >
      <PlusIcon className="size-6" strokeWidth={2.4} />
    </Link>
  );
}
