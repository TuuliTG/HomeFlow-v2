import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { useHouseholdMembers } from '@/features/household/useHousehold';

interface MemberListProps {
  householdId: string;
  currentUserId: string;
}

export function MemberList({ householdId, currentUserId }: MemberListProps) {
  const members = useHouseholdMembers(householdId);

  return (
    <section aria-labelledby="members" className="flex flex-col gap-3">
      <h2 id="members" className="font-semibold text-slate-900">
        Members
      </h2>
      {members.isPending && <LoadingMessage />}
      {members.isError && (
        <p role="alert" className="text-sm text-red-700">
          We couldn&apos;t load the members.
        </p>
      )}
      {members.data && (
        <ul className="flex flex-col divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
          {members.data.map(({ userId, displayName }) => (
            <li key={userId} className="px-4 py-3 text-slate-900">
              {displayName ?? <span className="text-slate-500">New member (no name yet)</span>}
              {userId === currentUserId && <span className="text-slate-500"> (you)</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
