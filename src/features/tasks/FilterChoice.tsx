import { chipClassName } from '@/features/tasks/chipStyles';
import { type DueFilter, dueFilters } from '@/features/tasks/taskFilter';
import { useMessages } from '@/lib/i18n/i18n';

interface FilterChoiceProps {
  due: DueFilter;
  onDueChange: (due: DueFilter) => void;
  availableOnly: boolean;
  onAvailableOnlyChange: (availableOnly: boolean) => void;
}

/**
 * One tap to pick which due dates the board shows, and another to show only the tasks nobody has picked up;
 * the two combine, e.g. what is due today and still available.
 */
export function FilterChoice({
  due,
  onDueChange,
  availableOnly,
  onAvailableOnlyChange,
}: FilterChoiceProps) {
  const t = useMessages().tasks.board;
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">{t.show}</legend>
      <span aria-hidden="true" className="text-ink-muted text-sm font-semibold">
        {t.show}:
      </span>
      {dueFilters.map((option) => (
        <label key={option} className={chipClassName}>
          <input
            type="radio"
            name="task-filter"
            value={option}
            checked={due === option}
            onChange={() => {
              onDueChange(option);
            }}
            className="sr-only"
          />
          {t.filters[option]}
        </label>
      ))}
      <span aria-hidden="true" className="bg-line-strong h-6 w-px" />
      <label className={chipClassName}>
        <input
          type="checkbox"
          checked={availableOnly}
          onChange={(event) => {
            onAvailableOnlyChange(event.target.checked);
          }}
          className="sr-only"
        />
        {t.available}
      </label>
    </fieldset>
  );
}
