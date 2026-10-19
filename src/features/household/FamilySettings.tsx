import { useId } from 'react';
import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { useOwnHousehold } from '@/features/household/useHousehold';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

/**
 * In the settings: where adults invite family members and add children without email, since the
 * household page is otherwise reached only through the household's name at the top.
 */
export function FamilySettings() {
  const user = useLoggedInUser();
  const household = useOwnHousehold(user.id);
  const headingId = useId();
  const t = useMessages().household.family;

  if (!household.data) return null;
  // Only adults get the invite code (household_invite_code()), and only adults add children.
  const isAdult = household.data.inviteCode !== null;
  return (
    <section
      aria-labelledby={headingId}
      className="bg-surface shadow-card mt-6 flex flex-col gap-3 rounded-2xl p-4"
    >
      <h2 id={headingId} className="text-ink font-semibold">
        {t.heading}
      </h2>
      <p className="text-ink-muted text-sm">{isAdult ? t.adultHint : t.childHint}</p>
      <Link to={paths.household} className="text-brand-600 w-fit text-sm font-semibold underline">
        {t.link(household.data.name)}
      </Link>
    </section>
  );
}
