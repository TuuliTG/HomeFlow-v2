import { useId, useState } from 'react';

import { SavingSwitch } from '@/components/ui/SavingSwitch';
import { ConfirmRemoveChild } from '@/features/household/ConfirmRemoveChild';
import type { HouseholdMember, SignInCode } from '@/features/household/household';
import { SignInCodeCard } from '@/features/household/SignInCodeCard';
import {
  useNewChildSignInCode,
  useRemoveChild,
  useSetChildOnThisDevice,
  useSetMemberCanAddTasks,
  useSetMemberIsChild,
} from '@/features/household/useHousehold';
import { useAuth } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

interface MemberSettingsProps {
  householdId: string;
  /** Another member of the household, whose settings an adult changes. */
  member: HouseholdMember;
  /** After the child was removed from the household, when there is nothing left to show. */
  onRemoved: () => void;
}

const rowClassName = 'border-line flex min-h-14 items-center border-t px-4 py-1.5 first:border-t-0';

/**
 * What an adult can change about another member, as full-width rows (ADR 0003): whether they are a child and, for a
 * child, whether they may add tasks; for a child without email, also being signed in on this device, a new sign-in
 * code and removing them.
 */
export function MemberSettings({ householdId, member, onRemoved }: MemberSettingsProps) {
  const setIsChild = useSetMemberIsChild(householdId);
  const setCanAddTasks = useSetMemberCanAddTasks(householdId);
  const { otherAccounts } = useAuth();
  const childHere = useSetChildOnThisDevice();
  const { common, household } = useMessages();
  const t = household.members;
  const headingId = useId();
  const name = member.displayName ?? common.newMember;
  const memberId = member.userId;
  const failure = (
    [
      [setIsChild.isError || setCanAddTasks.isError, t.saveFailed],
      [childHere.isError, t.setOnThisDeviceFailed],
    ] as const
  ).find(([isError]) => isError)?.[1];

  return (
    <section
      {...(member.isChild ? { 'aria-labelledby': headingId } : { 'aria-label': t.settings })}
      className="flex flex-col gap-3"
    >
      {/* Only a child's page has their tasks above to set the settings apart from. */}
      {member.isChild && (
        <h2 id={headingId} className="text-ink text-xl font-extrabold">
          {t.settings}
        </h2>
      )}
      <ul className="bg-surface shadow-card flex flex-col rounded-2xl">
        {/* A child without email has no password to log in with as an adult. */}
        {!member.signsInWithCode && (
          <li className={rowClassName}>
            <SavingSwitch
              label={t.child}
              checked={member.isChild}
              disabled={setIsChild.isPending}
              onChange={(isChild) =>
                setIsChild.mutateAsync({ memberId, isChild }).then(
                  () => undefined,
                  () => undefined,
                )
              }
            />
          </li>
        )}
        {member.isChild && (
          <li className={rowClassName}>
            <SavingSwitch
              label={t.canAddTasks}
              checked={member.canAddTasks}
              disabled={setCanAddTasks.isPending}
              onChange={(canAddTasks) =>
                setCanAddTasks.mutateAsync({ memberId, canAddTasks }).then(
                  () => undefined,
                  () => undefined,
                )
              }
            />
          </li>
        )}
        {member.signsInWithCode && (
          <>
            <li className={rowClassName}>
              <SavingSwitch
                label={t.onThisDevice}
                checked={otherAccounts.some((account) => account.userId === memberId)}
                disabled={childHere.isPending}
                onChange={(onThisDevice) =>
                  childHere
                    .mutateAsync({ childId: memberId, displayName: name, onThisDevice })
                    .then(
                      () => undefined,
                      () => undefined,
                    )
                }
              />
            </li>
            <NewCodeRow memberId={memberId} name={name} />
            <RemoveRow
              householdId={householdId}
              memberId={memberId}
              name={name}
              onRemoved={onRemoved}
            />
          </>
        )}
      </ul>
      {failure && (
        <p role="alert" className="text-danger-700 text-sm">
          {failure}
        </p>
      )}
    </section>
  );
}

/** Makes a new sign-in code for a child without email and shows it below. */
function NewCodeRow({ memberId, name }: { memberId: string; name: string }) {
  const newCode = useNewChildSignInCode();
  const [shown, setShown] = useState<SignInCode | null>(null);
  const t = useMessages().household.members;
  return (
    <li className={`${rowClassName} flex-col items-stretch gap-3 py-3`}>
      <button
        type="button"
        disabled={newCode.isPending}
        onClick={() => {
          newCode.mutate(memberId, { onSuccess: setShown });
        }}
        className="text-ink min-h-11 text-left text-base font-medium disabled:opacity-60"
      >
        {t.newCode}
      </button>
      {/* Announced to screen readers when a code appears or changes. */}
      <div aria-live="polite">
        {shown && <SignInCodeCard childName={name} signInCode={shown} />}
      </div>
      {newCode.isError && (
        <p role="alert" className="text-danger-700 text-sm">
          {t.newCodeFailed}
        </p>
      )}
    </li>
  );
}

interface RemoveRowProps {
  householdId: string;
  memberId: string;
  name: string;
  onRemoved: () => void;
}

/** Removes a child without email from the household, with everything they did, once the adult confirms. */
function RemoveRow({ householdId, memberId, name, onRemoved }: RemoveRowProps) {
  const removeChild = useRemoveChild(householdId);
  const [isConfirming, setIsConfirming] = useState(false);
  const t = useMessages().household.members;
  return (
    <li className={`${rowClassName} flex-col items-stretch gap-3 py-3`}>
      {isConfirming ? (
        <ConfirmRemoveChild
          name={name}
          isSaving={removeChild.isPending}
          onRemove={() => {
            // Not mutate()'s onSuccess: the refreshed member list removes this page before it would run.
            removeChild.mutateAsync(memberId).then(onRemoved, () => undefined);
          }}
          onKeep={() => {
            setIsConfirming(false);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setIsConfirming(true);
          }}
          className="text-danger-700 min-h-11 text-left text-base font-semibold"
        >
          {t.removeFromFamily(name)}
        </button>
      )}
      {removeChild.isError && (
        <p role="alert" className="text-danger-700 text-sm">
          {t.removeFailed}
        </p>
      )}
    </li>
  );
}
