import { useState } from 'react';

import { LoadingMessage } from '@/components/ui/LoadingMessage';
import type { HouseholdMember, SignInCode } from '@/features/household/household';
import {
  useHouseholdMembers,
  useNewChildSignInCode,
  useSetMemberIsChild,
} from '@/features/household/useHousehold';
import { useMessages } from '@/lib/i18n/i18n';

interface MemberListProps {
  householdId: string;
  currentUserId: string;
  /** Shows a new sign-in code an adult made for a child without email. */
  onSignInCode: (childName: string, signInCode: SignInCode) => void;
}

export function MemberList({ householdId, currentUserId, onSignInCode }: MemberListProps) {
  const members = useHouseholdMembers(householdId);
  const setIsChild = useSetMemberIsChild(householdId);
  const newCode = useNewChildSignInCode();
  const t = useMessages();
  const isAdult = members.data?.some(
    (member) => member.userId === currentUserId && !member.isChild,
  );

  return (
    <section aria-labelledby="members" className="flex flex-col gap-3">
      <h2 id="members" className="font-semibold text-slate-900">
        {t.household.members.heading}
      </h2>
      {members.isPending && <LoadingMessage />}
      {members.isError && (
        <p role="alert" className="text-sm text-red-700">
          {t.household.members.loadFailed}
        </p>
      )}
      {members.data && (
        <ul className="flex flex-col divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
          {members.data.map((member) => (
            <MemberRow
              key={member.userId}
              member={member}
              isYou={member.userId === currentUserId}
              // An adult decides for the others, never for themselves, so the household keeps an adult.
              onChildChange={
                isAdult && member.userId !== currentUserId
                  ? (isChild) =>
                      // A failure shows through isError below.
                      setIsChild
                        .mutateAsync({ memberId: member.userId, isChild })
                        .catch(() => undefined)
                  : undefined
              }
              isSaving={setIsChild.isPending}
              isMakingCode={newCode.isPending}
              onNewCode={
                isAdult && member.signsInWithCode
                  ? (childName) => {
                      newCode.mutate(member.userId, {
                        onSuccess: (signInCode) => {
                          onSignInCode(childName, signInCode);
                        },
                      });
                    }
                  : undefined
              }
            />
          ))}
        </ul>
      )}
      {(setIsChild.isError || newCode.isError) && (
        <p role="alert" className="text-sm text-red-700">
          {setIsChild.isError
            ? t.household.members.setChildFailed
            : t.household.members.newCodeFailed}
        </p>
      )}
      {members.data && <p className="text-sm text-slate-600">{t.household.members.childrenHint}</p>}
    </section>
  );
}

interface MemberRowProps {
  member: HouseholdMember;
  isYou: boolean;
  /**
   * Lets the user mark the member as a child or an adult, settling once the members are reloaded; left
   * out when they can't.
   */
  onChildChange: ((isChild: boolean) => Promise<void>) | undefined;
  isSaving: boolean;
  /** Makes a new sign-in code for a child without email; left out for anyone else. */
  onNewCode: ((childName: string) => void) | undefined;
  /** A code is being made, so another tap wouldn't replace it before it shows. */
  isMakingCode: boolean;
}

function MemberRow({
  member,
  isYou,
  onChildChange,
  isSaving,
  onNewCode,
  isMakingCode,
}: MemberRowProps) {
  const t = useMessages();
  const name = member.displayName ?? t.common.newMember;
  /** The choice being saved, shown straight away; null once the saved one has loaded. */
  const [savingIsChild, setSavingIsChild] = useState<boolean | null>(null);
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3 text-slate-900">
      <div className="flex flex-col items-start gap-1">
        <span>
          {member.displayName ?? <span className="text-slate-500">{t.common.newMember}</span>}
          {isYou && <span className="text-slate-500">{t.household.members.you}</span>}
        </span>
        {onNewCode && (
          <button
            type="button"
            aria-label={t.household.members.newCodeFor(name)}
            disabled={isMakingCode}
            onClick={() => {
              onNewCode(name);
            }}
            className="text-brand-600 text-sm font-medium underline disabled:opacity-60"
          >
            {t.household.members.newCode}
          </button>
        )}
      </div>
      {onChildChange ? (
        <label className="flex shrink-0 items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            aria-label={t.household.members.isChild(name)}
            checked={savingIsChild ?? member.isChild}
            disabled={isSaving}
            onChange={(event) => {
              setSavingIsChild(event.target.checked);
              void onChildChange(event.target.checked).finally(() => {
                setSavingIsChild(null);
              });
            }}
            className="accent-brand-600 size-4"
          />
          {t.household.members.child}
        </label>
      ) : (
        member.isChild && (
          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
            {t.household.members.child}
          </span>
        )
      )}
    </li>
  );
}
