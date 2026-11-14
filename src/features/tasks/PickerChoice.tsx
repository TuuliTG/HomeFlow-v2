import { filterLegendClassName } from '@/features/tasks/chipStyles';
import { FilterChip } from '@/features/tasks/FilterChip';
import type { HouseholdMember } from '@/features/tasks/helpersApi';
import { pickerName } from '@/features/tasks/pickerFilter';
import { useMessages } from '@/lib/i18n/i18n';

interface PickerChoiceProps {
  currentUserId: string;
  /** The adults to tell apart; none for the tasks for children, which adults don't pick up. */
  members: HouseholdMember[];
  picker: HouseholdMember | null;
  onChange: (pickerId: string | null) => void;
  availableOnly: boolean;
  onAvailableOnlyChange: (availableOnly: boolean) => void;
}

/**
 * One tap to see the tasks nobody has picked up, or those one adult has (you, then the others), and another on
 * the same choice to see all again. At most one is chosen.
 */
export function PickerChoice({
  currentUserId,
  members,
  picker,
  onChange,
  availableOnly,
  onAvailableOnlyChange,
}: PickerChoiceProps) {
  const messages = useMessages();
  const t = messages.tasks.board;
  // With one adult, there is no one to tell apart.
  const adults = members.length < 2 ? [] : members;
  const ordered = [
    ...adults.filter((member) => member.id === currentUserId),
    ...adults.filter((member) => member.id !== currentUserId),
  ];
  return (
    <fieldset>
      <legend className={filterLegendClassName}>{t.who}</legend>
      <div className="flex flex-wrap gap-2">
        <FilterChip label={t.nobody} checked={availableOnly} onChange={onAvailableOnlyChange} />
        {ordered.map((member) => (
          <FilterChip
            key={member.id}
            label={pickerName(member, currentUserId, messages)}
            checked={picker?.id === member.id}
            onChange={(checked) => {
              onChange(checked ? member.id : null);
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}
