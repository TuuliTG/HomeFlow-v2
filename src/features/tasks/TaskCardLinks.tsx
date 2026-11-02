import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { canChange, canRequest, membersToAsk, type Task } from '@/features/tasks/task';
import { useHouseholdMembers } from '@/features/tasks/useHelpers';
import { useMembership } from '@/features/tasks/useTasks';
import { useMessages } from '@/lib/i18n/i18n';

/** The links on a task card, next to its actions. */
interface TaskLinkProps {
  task: Task;
  currentUserId: string;
}

/** Edit, for adults and for a child on a task they added (`private.can_change_task()`). */
export function EditLink({ task, currentUserId }: TaskLinkProps) {
  const membership = useMembership(currentUserId);
  const t = useMessages().tasks.card;
  // Hidden until it's known whether the user is a child.
  if (!canChange(task, currentUserId, membership.data?.isChild ?? true)) return null;
  return (
    <Link
      to={paths.editTask(task.id)}
      aria-label={t.editLabel(task.title)}
      className={textLinkClassName}
    >
      {t.edit}
    </Link>
  );
}

const textLinkClassName =
  'text-brand-900 flex min-h-11 items-center rounded-lg px-1 text-sm font-semibold underline-offset-2 hover:underline';

/**
 * Ask, to ask another member to do a task that is free or the user's, unless someone is already asked
 * (the request on the card can be cancelled) or nobody else could do it.
 */
export function AskLink({ task, currentUserId }: TaskLinkProps) {
  const members = useHouseholdMembers(currentUserId);
  const t = useMessages().tasks.requests;
  const isWaiting = task.request !== null && task.request.answer === null;
  // Hidden until it's known whether anyone else could do it.
  const canAskSomeone = membersToAsk(task, members.data ?? [], currentUserId).length > 0;
  if (!canRequest(task, currentUserId) || isWaiting || !canAskSomeone) return null;
  return (
    <Link
      to={paths.askForTask(task.id)}
      aria-label={t.askLabel(task.title)}
      className={textLinkClassName}
    >
      {t.ask}
    </Link>
  );
}
