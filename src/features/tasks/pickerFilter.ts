import type { HouseholdMember } from '@/features/tasks/helpersApi';
import { useHouseholdMembers } from '@/features/tasks/useHelpers';
import type { Messages } from '@/lib/i18n/i18n';
import { useSearchParam } from '@/lib/useSearchParam';

const PICKER_PARAM = 'who';

/**
 * Whose picked-up tasks the board shows, kept in the address as `?who=<user id>` and remembered on this device;
 * everyone's by default, also for someone who isn't in the household (any more). Returns the member chosen, the
 * household's members and how to choose another.
 */
export function usePickerFilter(userId: string) {
  const members = useHouseholdMembers(userId);
  const [pickerId, setPickerId] = useSearchParam<string | null>({
    name: PICKER_PARAM,
    parse: (value) => value,
    serialise: (value) => value,
    rememberAs: `board.${PICKER_PARAM}:${userId}`,
  });
  const all = members.data ?? [];
  const picker = all.find((member) => member.id === pickerId) ?? null;
  return { picker, members: all, setPickerId };
}

/** What the board says when nothing it shows is picked up by the member chosen. */
export function nothingPickedUpMessage(
  picker: HouseholdMember,
  currentUserId: string,
  { common, tasks }: Messages,
): string {
  if (picker.id === currentUserId) return tasks.board.noneForYou;
  return tasks.board.noneFor(picker.name ?? common.someone);
}
