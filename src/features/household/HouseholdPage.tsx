import { useState } from 'react';

import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { AddChildForm } from '@/features/household/AddChildForm';
import type { SignInCode } from '@/features/household/household';
import { InviteCode } from '@/features/household/InviteCode';
import { MemberList } from '@/features/household/MemberList';
import { SignInCodeCard } from '@/features/household/SignInCodeCard';
import { useOwnHousehold } from '@/features/household/useHousehold';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

/**
 * The user's household: who is in it and, for adults, its invite code to share and adding a child
 * without email.
 */
export function HouseholdPage() {
  const user = useLoggedInUser();
  const household = useOwnHousehold(user.id);
  const [shownCode, setShownCode] = useState<{ childName: string; signInCode: SignInCode } | null>(
    null,
  );
  const t = useMessages().household;

  if (household.isPending) return <LoadingMessage />;
  if (!household.data) {
    return (
      <>
        <PageHeader eyebrow={t.eyebrow} title={t.yourHousehold} />
        <p role="alert" className="text-sm text-red-700">
          {t.loadFailed}
        </p>
      </>
    );
  }

  const { id, name, inviteCode } = household.data;
  // Only adults get the invite code (household_invite_code()), and only adults add children.
  const isAdult = inviteCode !== null;
  const showCode = (childName: string, signInCode: SignInCode) => {
    setShownCode({ childName, signInCode });
  };
  return (
    <>
      <PageHeader eyebrow={t.eyebrow} title={name} />
      <div className="flex flex-col gap-6">
        {isAdult && <InviteCode code={inviteCode} />}
        <MemberList householdId={id} currentUserId={user.id} onSignInCode={showCode} />
        {/* Announced to screen readers when a code appears or changes. */}
        <div aria-live="polite">{shownCode && <SignInCodeCard {...shownCode} />}</div>
        {isAdult && <AddChildForm householdId={id} onAdded={showCode} />}
      </div>
    </>
  );
}
