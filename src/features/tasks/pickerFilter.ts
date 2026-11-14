import type { HouseholdMember } from '@/features/tasks/helpersApi';
import { useHouseholdMembers } from '@/features/tasks/useHelpers';
import type { Messages } from '@/lib/i18n/i18n';
import { useSearchParam } from '@/lib/useSearchParam';

const PICKER_PARAM = 'who';

/**
 * Whose picked-up tasks the board shows, kept in the address as `?who=<user id>` and remembered on this device;
 * everyone's by default, also for someone who isn't in the household (any more) or is a child, since children
 * don't pick up adults' tasks. Returns the adult chosen, the household's adults and how to choose another.
 */
export function usePickerFilter(userId: string) {
  const members = useHouseholdMembers(userId);
  const [pickerId, setPickerId] = useSearchParam<string | null>({
    name: PICKER_PARAM,
    parse: (value) => value,
    serialise: (value) => value,
    rememberAs: `board.${PICKER_PARAM}:${userId}`,
  });
  const adults = (members.data ?? []).filter((member) => !member.isChild);
  const picker = adults.find((member) => member.id === pickerId) ?? null;
  return { picker, members: adults, setPickerId };
}

/** What the board says when nothing it shows is picked up by the member chosen. */
export function nothingPickedUpMessage(
  picker: HouseholdMember,
  currentUserId: string,
  messages: Messages,
): string {
  if (picker.id === currentUserId) return messages.tasks.board.noneForYou;
  return messages.tasks.board.noneFor(pickerName(picker, currentUserId, messages));
}

/** What the board's filters call a member: you, or their name. */
export function pickerName(
  member: HouseholdMember,
  currentUserId: string,
  { common, tasks }: Messages,
): string {
  return member.id === currentUserId ? tasks.board.you : (member.name ?? common.someone);
}
