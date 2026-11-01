import { Link } from 'react-router';

import { paths } from '@/app/paths';
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
      className="bg-brand-700 hover:bg-brand-900 shrink-0 rounded-xl px-3 py-2 text-sm font-bold text-white"
    >
      <span aria-hidden="true">+ </span>
      {t.tasks.newTask}
    </Link>
  );
}
