import { chipClassName } from '@/features/tasks/chipStyles';
import type { HouseholdMember } from '@/features/tasks/helpersApi';
import { useMessages } from '@/lib/i18n/i18n';

interface PickerChoiceProps {
  currentUserId: string;
  members: HouseholdMember[];
  picker: HouseholdMember | null;
  onChange: (pickerId: string | null) => void;
}

/**
 * One tap to see the tasks one family member has picked up (you, then the others), and another on the same name
 * to see everyone's again. At most one is chosen; none shows everyone's.
 */
export function PickerChoice({ currentUserId, members, picker, onChange }: PickerChoiceProps) {
  const { common, tasks } = useMessages();
  const t = tasks.board;
  // Nobody else to tell apart.
  if (members.length < 2) return null;
  const others = members.filter((member) => member.id !== currentUserId);
  const options = [
    { id: currentUserId, label: t.you },
    ...others.map((member) => ({ id: member.id, label: member.name ?? common.someone })),
  ];
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">{t.who}</legend>
      <span aria-hidden="true" className="text-ink-muted text-sm font-semibold">
        {t.who}:
      </span>
      {options.map((option) => (
        <label key={option.id} className={chipClassName}>
          <input
            type="checkbox"
            checked={picker?.id === option.id}
            onChange={(event) => {
              onChange(event.target.checked ? option.id : null);
            }}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
