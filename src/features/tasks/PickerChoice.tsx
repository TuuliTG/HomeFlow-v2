import { ChoiceChips } from '@/features/tasks/ChoiceChips';
import type { HouseholdMember } from '@/features/tasks/helpersApi';
import { useMessages } from '@/lib/i18n/i18n';

const EVERYONE = 'everyone';

interface PickerChoiceProps {
  currentUserId: string;
  members: HouseholdMember[];
  picker: HouseholdMember | null;
  onChange: (pickerId: string | null) => void;
}

/** One tap to see the tasks one family member has picked up: everyone, you, then the others. */
export function PickerChoice({ currentUserId, members, picker, onChange }: PickerChoiceProps) {
  const { common, tasks } = useMessages();
  const t = tasks.board;
  // Nobody else to tell apart.
  if (members.length < 2) return null;
  const others = members.filter((member) => member.id !== currentUserId);
  const options = [
    { value: EVERYONE, label: t.everyone },
    { value: currentUserId, label: t.you },
    ...others.map((member) => ({ value: member.id, label: member.name ?? common.someone })),
  ];
  return (
    <ChoiceChips
      legend={t.who}
      name="task-picker"
      options={options}
      value={picker?.id ?? EVERYONE}
      onChange={(value) => {
        onChange(value === EVERYONE ? null : value);
      }}
    />
  );
}
