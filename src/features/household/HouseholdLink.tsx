import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { MemberAvatars } from '@/components/ui/MemberAvatars';
import { useHouseholdMembers, useOwnHousehold } from '@/features/household/useHousehold';
import { useLoggedInUser } from '@/lib/auth';

/**
 * The family's initials and name as a pill leading to the Family page, where each child's tasks are set up. Hidden
 * until there is a household.
 */
export function HouseholdLink() {
  const user = useLoggedInUser();
  const household = useOwnHousehold(user.id);

  if (!household.data) return null;

  return (
    <Link
      to={paths.household}
      className="bg-surface shadow-card text-brand-900 hover:bg-brand-50 mr-auto flex min-h-11 min-w-0 items-center gap-2 rounded-full py-1 pr-4 pl-1.5 text-sm font-bold"
    >
      <FamilyInitials householdId={household.data.id} />
      <span className="truncate">{household.data.name}</span>
    </Link>
  );
}

function FamilyInitials({ householdId }: { householdId: string }) {
  const members = useHouseholdMembers(householdId);
  if (!members.data) return null;
  return <MemberAvatars names={members.data.map((member) => member.displayName)} />;
}
