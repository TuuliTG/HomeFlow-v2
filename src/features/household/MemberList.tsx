import { useState } from 'react';

import { TrashIcon } from '@/components/ui/icons';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { ConfirmRemoveChild } from '@/features/household/ConfirmRemoveChild';
import type { HouseholdMember, SignInCode } from '@/features/household/household';
import { SavingCheckbox } from '@/components/ui/SavingCheckbox';
import {
  useHouseholdMembers,
  useNewChildSignInCode,
  useRemoveChild,
  useSetChildOnThisDevice,
  useSetMemberCanAddTasks,
  useSetMemberIsChild,
} from '@/features/household/useHousehold';
import { useAuth } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

interface MemberListProps {
  householdId: string;
  currentUserId: string;
  /** Shows a new sign-in code an adult made for a child without email. */
  onSignInCode: (childName: string, signInCode: SignInCode) => void;
}

/** What the user can change about a member; each is left out when they can't. */
interface MemberActions {
  /** Marks the member as a child or an adult, settling once the members are reloaded. */
  setIsChild?: (isChild: boolean) => Promise<void>;
  /** Lets a child add tasks or stops them, settling once the members are reloaded. */
  setCanAddTasks?: (canAddTasks: boolean) => Promise<void>;
  /** Makes a new sign-in code for a child without email. */
  newCode?: (childName: string) => void;
  /** Whether a child without email is signed in on this device, waiting to be switched to. */
  isOnThisDevice?: boolean;
  /** Signs a child without email in on this device or out of it, settling once that is done. */
  setOnThisDevice?: (onThisDevice: boolean) => Promise<void>;
  /** Removes a child without email from the household, with everything they did. */
  remove?: () => void;
}

/**
 * What an adult can change about each member, and how saving is going. An adult decides for the others,
 * never for themselves, so the household keeps an adult. A failure shows as `failure`, so saves settle
 * either way.
 */
function useMemberActions(
  householdId: string,
  currentUserId: string,
  onSignInCode: MemberListProps['onSignInCode'],
) {
  const setIsChild = useSetMemberIsChild(householdId);
  const setCanAddTasks = useSetMemberCanAddTasks(householdId);
  const newCode = useNewChildSignInCode();
  const childHere = useSetChildOnThisDevice();
  const removeChild = useRemoveChild(householdId);
  const { otherAccounts } = useAuth();
  const t = useMessages().household.members;

  function actionsFor(member: HouseholdMember, isAdult: boolean): MemberActions {
    if (!isAdult || member.userId === currentUserId) return {};
    const memberId = member.userId;
    return {
      setIsChild: (isChild) => setIsChild.mutateAsync({ memberId, isChild }).catch(() => undefined),
      ...(member.isChild && {
        setCanAddTasks: (canAdd: boolean) =>
          setCanAddTasks.mutateAsync({ memberId, canAddTasks: canAdd }).catch(() => undefined),
      }),
      ...(member.signsInWithCode && {
        newCode: (childName: string) => {
          newCode.mutate(memberId, {
            onSuccess: (signInCode) => {
              onSignInCode(childName, signInCode);
            },
          });
        },
        isOnThisDevice: otherAccounts.some((account) => account.userId === memberId),
        setOnThisDevice: (onThisDevice: boolean) =>
          childHere
            .mutateAsync({ childId: memberId, displayName: member.displayName ?? '', onThisDevice })
            .catch(() => undefined),
        remove: () => {
          removeChild.mutate(memberId);
        },
      }),
    };
  }

  return {
    actionsFor,
    isSaving: [setIsChild, setCanAddTasks, removeChild].some((saving) => saving.isPending),
    isMakingCode: newCode.isPending || childHere.isPending,
    failure: (
      [
        [setIsChild, t.setChildFailed],
        [setCanAddTasks, t.setCanAddTasksFailed],
        [newCode, t.newCodeFailed],
        [childHere, t.setOnThisDeviceFailed],
        [removeChild, t.removeFailed],
      ] as const
    ).find(([saving]) => saving.isError)?.[1],
  };
}

export function MemberList({ householdId, currentUserId, onSignInCode }: MemberListProps) {
  const members = useHouseholdMembers(householdId);
  const { actionsFor, isSaving, isMakingCode, failure } = useMemberActions(
    householdId,
    currentUserId,
    onSignInCode,
  );
  const t = useMessages().household.members;
  const isAdult =
    members.data?.some((member) => member.userId === currentUserId && !member.isChild) ?? false;

  return (
    <section aria-labelledby="members" className="flex flex-col gap-3">
      <h2 id="members" className="text-ink font-semibold">
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
            <MemberRow
              key={member.userId}
              member={member}
              isYou={member.userId === currentUserId}
              actions={actionsFor(member, isAdult)}
              isSaving={isSaving}
              isMakingCode={isMakingCode}
            />
          ))}
        </ul>
      )}
      {failure && (
        <p role="alert" className="text-danger-700 text-sm">
          {failure}
        </p>
      )}
    </section>
  );
}

interface MemberRowProps {
  member: HouseholdMember;
  isYou: boolean;
  actions: MemberActions;
  isSaving: boolean;
  /** A code is being made (or used), so another tap wouldn't replace it before it shows. */
  isMakingCode: boolean;
}

function MemberRow({ member, isYou, actions, isSaving, isMakingCode }: MemberRowProps) {
  const { common, household } = useMessages();
  const t = household.members;
  const name = member.displayName ?? common.newMember;
  const { newCode, remove } = actions;
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false);
  return (
    <li className="text-ink flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex flex-col items-start gap-1">
        <span className="flex items-center gap-1">
          {member.displayName ?? <span className="text-ink-muted">{common.newMember}</span>}
          {isYou && <span className="text-ink-muted">{t.you}</span>}
          {remove && !isConfirmingRemove && (
            <button
              type="button"
              aria-label={t.remove(name)}
              disabled={isSaving}
              onClick={() => {
                setIsConfirmingRemove(true);
              }}
              className="text-ink-muted hover:text-danger-700 rounded-lg p-1 disabled:opacity-60"
            >
              <TrashIcon className="size-4" />
            </button>
          )}
        </span>
        {newCode && (
          <button
            type="button"
            aria-label={t.newCodeFor(name)}
            disabled={isMakingCode}
            onClick={() => {
              newCode(name);
            }}
            className="text-brand-600 text-sm font-medium underline disabled:opacity-60"
          >
            {t.newCode}
          </button>
        )}
      </div>
      <MemberChoices
        member={member}
        name={name}
        actions={actions}
        isSaving={isSaving}
        isMakingCode={isMakingCode}
      />
      {remove && isConfirmingRemove && (
        <ConfirmRemoveChild
          name={name}
          isSaving={isSaving}
          onRemove={remove}
          onKeep={() => {
            setIsConfirmingRemove(false);
          }}
        />
      )}
    </li>
  );
}

/** The checkboxes beside a member, or just a "Child" label for someone who can't change them. */
function MemberChoices({
  member,
  name,
  actions,
  isSaving,
  isMakingCode,
}: Omit<MemberRowProps, 'isYou'> & { name: string }) {
  const t = useMessages().household.members;
  const { setIsChild, setCanAddTasks, setOnThisDevice } = actions;
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      {setIsChild ? (
        <SavingCheckbox
          label={t.child}
          ariaLabel={t.isChild(name)}
          checked={member.isChild}
          disabled={isSaving}
          onChange={setIsChild}
        />
      ) : (
        member.isChild && (
          <span className="bg-done-100 text-done-800 rounded-full px-2 py-0.5 text-xs font-medium">
            {t.child}
          </span>
        )
      )}
      {setCanAddTasks && (
        <SavingCheckbox
          label={t.canAddTasks}
          ariaLabel={t.canAddTasksFor(name)}
          checked={member.canAddTasks}
          disabled={isSaving}
          onChange={setCanAddTasks}
        />
      )}
      {setOnThisDevice && (
        <SavingCheckbox
          label={t.onThisDevice}
          ariaLabel={t.onThisDeviceFor(name)}
          checked={actions.isOnThisDevice ?? false}
          disabled={isMakingCode}
          onChange={setOnThisDevice}
        />
      )}
    </div>
  );
}
