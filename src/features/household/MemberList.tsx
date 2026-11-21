import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import type { HouseholdMember } from '@/features/household/household';
import { useHouseholdMembers } from '@/features/household/useHousehold';
import { useMessages } from '@/lib/i18n/i18n';

interface MemberListProps {
  householdId: string;
  currentUserId: string;
}

/**
 * The household's members, one row each: their initial, name and role. An adult opens another member's page from
 * their row, to set them up (`paths.member`); the settings aren't on the list, so it stays easy to read and tap.
 */
export function MemberList({ householdId, currentUserId }: MemberListProps) {
  const members = useHouseholdMembers(householdId);
  const t = useMessages().household.members;
  const isAdult =
    members.data?.some((member) => member.userId === currentUserId && !member.isChild) ?? false;

  return (
    <section aria-labelledby="members" className="flex flex-col gap-3">
      <h2 id="members" className="text-ink text-xl font-extrabold">
        {t.heading}
      </h2>
      {members.isPending && <LoadingMessage />}
      {members.isError && (
        <p role="alert" className="text-danger-700 text-sm">
          {t.loadFailed}
        </p>
      )}
      {members.data && (
        <ul className="divide-line bg-surface shadow-card flex flex-col divide-y rounded-2xl">
          {members.data.map((member) => (
            <li key={member.userId}>
              <MemberRow
                member={member}
                isYou={member.userId === currentUserId}
                canOpen={isAdult && member.userId !== currentUserId}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface MemberRowProps {
  member: HouseholdMember;
  isYou: boolean;
  /** Whether the row opens the member's page: an adult's, for another member. */
  canOpen: boolean;
}

const rowClassName = 'text-ink flex min-h-16 items-center gap-3 px-4 py-3';

/** A member's initial, name and role ("You", "Adult" or "Child"), and an arrow when it opens their page. */
function MemberRow({ member, isYou, canOpen }: MemberRowProps) {
  const { common, household } = useMessages();
  const t = household.members;
  const name = member.displayName ?? common.newMember;
  const role = isYou ? t.roles.you : member.isChild ? t.roles.child : t.roles.adult;
  const content = (
    <>
      <span
        aria-hidden="true"
        className={`flex size-10 shrink-0 items-center justify-center rounded-full font-extrabold ${member.isChild ? 'bg-done-100 text-done-800' : 'bg-brand-100 text-brand-700'}`}
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`font-bold break-words ${member.displayName ? '' : 'text-ink-muted'}`}>
          {name}
        </span>{' '}
        <span className="text-ink-muted text-sm font-medium">{role}</span>
      </span>
    </>
  );
  if (!canOpen) return <div className={rowClassName}>{content}</div>;
  return (
    <Link
      to={paths.member(member.userId)}
      className={`${rowClassName} hover:bg-brand-50 rounded-2xl`}
    >
      {content}
      <span aria-hidden="true" className="text-line-strong text-2xl">
        ›
      </span>
    </Link>
  );
}
