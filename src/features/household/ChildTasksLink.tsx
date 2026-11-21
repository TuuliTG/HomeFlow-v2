import { Link } from 'react-router';

import { paths } from '@/app/paths';
import type { HouseholdMember } from '@/features/household/household';
import { useMessages } from '@/lib/i18n/i18n';

interface ChildTasksLinkProps {
  member: HouseholdMember;
  name: string;
  /** Whether the user can change things about the member: an adult, for another member. */
  canSetUp: boolean;
}

/** Opens the page where an adult sets up a child's tasks (`paths.childTasks`); nothing for anyone else. */
export function ChildTasksLink({ member, name, canSetUp }: ChildTasksLinkProps) {
  const t = useMessages().household.members;
  if (!canSetUp || !member.isChild) return null;
  return (
    <Link
      to={paths.childTasks(member.userId)}
      aria-label={t.tasksFor(name)}
      className="text-brand-600 text-sm font-medium underline"
    >
      {t.tasks}
    </Link>
  );
}
