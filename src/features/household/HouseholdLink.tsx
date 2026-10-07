import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { HomeIcon } from '@/components/ui/icons';
import { useOwnHousehold } from '@/features/household/useHousehold';
import { useAuth } from '@/lib/auth';

/** The household's name, leading to its page (invite code, members). Hidden until there is one. */
export function HouseholdLink() {
  const { user } = useAuth();
  const household = useOwnHousehold(user?.id);

  if (!household.data) return null;

  return (
    <Link
      to={paths.household}
      className="text-brand-900 mr-auto flex min-w-0 items-center gap-1.5 text-sm font-semibold hover:underline"
    >
      <HomeIcon className="size-5 shrink-0" />
      <span className="truncate">{household.data.name}</span>
    </Link>
  );
}
