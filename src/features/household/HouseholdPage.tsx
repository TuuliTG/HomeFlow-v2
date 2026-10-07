import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { InviteCode } from '@/features/household/InviteCode';
import { MemberList } from '@/features/household/MemberList';
import { useOwnHousehold } from '@/features/household/useHousehold';
import { useLoggedInUser } from '@/lib/auth';

/** The user's household: its invite code to share and who is in it. */
export function HouseholdPage() {
  const user = useLoggedInUser();
  const household = useOwnHousehold(user.id);

  if (household.isPending) return <LoadingMessage />;
  if (!household.data) {
    return (
      <>
        <PageHeader eyebrow="Household" title="Your household" />
        <p role="alert" className="text-sm text-red-700">
          We couldn&apos;t load your household. Check your connection and reload the page.
        </p>
      </>
    );
  }

  const { id, name, inviteCode } = household.data;
  return (
    <>
      <PageHeader eyebrow="Household" title={name} />
      <div className="flex flex-col gap-6">
        <InviteCode code={inviteCode} />
        <MemberList householdId={id} currentUserId={user.id} />
      </div>
    </>
  );
}
