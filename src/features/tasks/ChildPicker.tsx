import { Link, Navigate } from 'react-router';

import { paths } from '@/app/paths';
import { ChevronDownIcon } from '@/components/ui/icons';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { fromBoardState } from '@/features/tasks/childTasks';
import { useHouseholdMembers } from '@/features/tasks/useHelpers';
import { useMessages } from '@/lib/i18n/i18n';

/**
 * The children an adult adding a task for the children chooses from: each child's name opens their own form
 * (`paths.newChildTask`), and an only child's opens at once (ADR 0004).
 */
export function ChildPicker({ currentUserId }: { currentUserId: string }) {
  const members = useHouseholdMembers(currentUserId);
  const t = useMessages();

  if (members.data === undefined) {
    if (!members.isError) return <LoadingMessage />;
    return (
      <p role="alert" className="text-danger-700 text-sm">
        {t.tasks.me.loadFailed}
      </p>
    );
  }
  const children = members.data.filter((member) => member.isChild);
  const [onlyChild] = children;
  if (children.length === 1 && onlyChild) {
    return <Navigate to={paths.newChildTask(onlyChild.id)} state={fromBoardState} replace />;
  }
  if (children.length === 0) {
    return <p className="text-ink-muted text-sm">{t.taskForm.noChildren}</p>;
  }
  return (
    <ul aria-label={t.taskForm.whichChild} className="flex flex-col gap-2">
      {children.map((child) => (
        <li key={child.id}>
          <Link
            to={paths.newChildTask(child.id)}
            state={fromBoardState}
            className="bg-surface shadow-card text-ink focus-visible:outline-brand-600 flex min-h-14 items-center justify-between rounded-2xl px-4 font-medium focus-visible:outline-2"
          >
            {child.name ?? t.common.someone}
            <ChevronDownIcon className="text-ink-muted size-5 -rotate-90" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
