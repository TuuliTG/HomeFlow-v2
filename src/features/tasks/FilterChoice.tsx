import { chipClassName, filterLegendClassName } from '@/features/tasks/chipStyles';
import { type DueFilter, dueFilters } from '@/features/tasks/taskFilter';
import { useMessages } from '@/lib/i18n/i18n';

interface FilterChoiceProps {
  due: DueFilter;
  onChange: (due: DueFilter) => void;
}

/** One tap to pick which due dates the board shows. */
export function FilterChoice({ due, onChange }: FilterChoiceProps) {
  const t = useMessages().tasks.board;
  return (
    <fieldset>
      <legend className={filterLegendClassName}>{t.dueDate}</legend>
      <div className="flex flex-wrap gap-2">
        {dueFilters.map((option) => (
          <label key={option} className={chipClassName}>
            <input
              type="radio"
              name="task-filter"
              value={option}
              checked={due === option}
              onChange={() => {
                onChange(option);
              }}
              className="sr-only"
            />
            {t.filters[option]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
