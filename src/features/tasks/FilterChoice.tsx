import { FilterChip } from '@/features/tasks/FilterChip';
import { type DueFilter, dueFilters } from '@/features/tasks/taskFilter';
import { useMessages } from '@/lib/i18n/i18n';

interface FilterChoiceProps {
  due: DueFilter;
  onChange: (due: DueFilter) => void;
}

/**
 * One tap to pick which due dates the board shows, and another on the same choice to show all again (the
 * default, with none chosen). At most one is chosen.
 */
export function FilterChoice({ due, onChange }: FilterChoiceProps) {
  const t = useMessages().tasks.board;
  return (
    <fieldset>
      <legend className="sr-only">{t.dueDate}</legend>
      <div className="flex flex-wrap gap-2">
        {dueFilters
          .filter((option) => option !== 'all')
          .map((option) => (
            <FilterChip
              key={option}
              label={t.filters[option]}
              checked={due === option}
              onChange={(checked) => {
                onChange(checked ? option : 'all');
              }}
            />
          ))}
      </div>
    </fieldset>
  );
}
