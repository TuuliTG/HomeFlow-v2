import { LoadingMessage } from '@/components/ui/LoadingMessage';
import type { HouseholdMember, SignInCode } from '@/features/household/household';
import { SavingCheckbox } from '@/features/household/SavingCheckbox';
import {
  useHouseholdMembers,
  useNewChildSignInCode,
  useSetMemberCanAddTasks,
  useSetMemberIsChild,
} from '@/features/household/useHousehold';
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
      }),
    };
  }

  return {
    actionsFor,
    isSaving: setIsChild.isPending || setCanAddTasks.isPending,
    isMakingCode: newCode.isPending,
    failure:
      (setIsChild.isError && t.setChildFailed) ||
      (setCanAddTasks.isError && t.setCanAddTasksFailed) ||
      (newCode.isError && t.newCodeFailed),
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
      <h2 id="members" className="font-semibold text-slate-900">
        {t.heading}
      </h2>
      {members.isPending && <LoadingMessage />}
      {members.isError && (
        <p role="alert" className="text-sm text-red-700">
          {t.loadFailed}
        </p>
      )}
      {members.data && (
        <ul className="flex flex-col divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
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
        <p role="alert" className="text-sm text-red-700">
          {failure}
        </p>
      )}
      {members.data && <p className="text-sm text-slate-600">{t.childrenHint}</p>}
    </section>
  );
}

interface MemberRowProps {
  member: HouseholdMember;
  isYou: boolean;
  actions: MemberActions;
  isSaving: boolean;
  /** A code is being made, so another tap wouldn't replace it before it shows. */
  isMakingCode: boolean;
}

function MemberRow({ member, isYou, actions, isSaving, isMakingCode }: MemberRowProps) {
  const { common, household } = useMessages();
  const t = household.members;
  const name = member.displayName ?? common.newMember;
  const { newCode, setIsChild, setCanAddTasks } = actions;
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3 text-slate-900">
      <div className="flex flex-col items-start gap-1">
        <span>
          {member.displayName ?? <span className="text-slate-500">{common.newMember}</span>}
          {isYou && <span className="text-slate-500">{t.you}</span>}
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
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
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
      </div>
    </li>
  );
}
