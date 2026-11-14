import { type ReactNode, useId, useRef, useState } from 'react';

import { CloseIcon, FilterIcon } from '@/components/ui/icons';
import { FilterChoice } from '@/features/tasks/FilterChoice';
import type { HouseholdMember } from '@/features/tasks/helpersApi';
import { PickerChoice } from '@/features/tasks/PickerChoice';
import { pickerName } from '@/features/tasks/pickerFilter';
import type { DueFilter } from '@/features/tasks/taskFilter';
import { useMessages } from '@/lib/i18n/i18n';

interface BoardFiltersProps {
  /** The search field, which the filter button sits next to. */
  children: ReactNode;
  currentUserId: string;
  due: DueFilter;
  onDueChange: (due: DueFilter) => void;
  availableOnly: boolean;
  onAvailableOnlyChange: (availableOnly: boolean) => void;
  /** The adults whose picked-up tasks can be shown; none for the tasks for children. */
  members: HouseholdMember[];
  picker: HouseholdMember | null;
  onPickerChange: (pickerId: string | null) => void;
}

/**
 * The board's filters, folded behind a button next to the search to keep the board clear. While folded, the
 * filters that are on show as chips that turn them off, so no task is hidden without anyone noticing.
 */
export function BoardFilters({ children, ...filters }: BoardFiltersProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const t = useMessages().tasks.board;
  return (
    <>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">{children}</div>
        <button
          ref={button}
          type="button"
          aria-label={t.filtersButton}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            setOpen(!open);
          }}
          className="border-line-strong bg-surface text-brand-900 aria-expanded:bg-brand-900 grid size-11 shrink-0 place-items-center rounded-xl border aria-expanded:border-transparent aria-expanded:text-white"
        >
          <FilterIcon className="size-6" />
        </button>
      </div>
      <div id={panelId} hidden={!open} className="flex flex-col gap-3">
        <FilterChoice due={filters.due} onChange={filters.onDueChange} />
        <PickerChoice
          currentUserId={filters.currentUserId}
          members={filters.members}
          picker={filters.picker}
          onChange={filters.onPickerChange}
          availableOnly={filters.availableOnly}
          onAvailableOnlyChange={filters.onAvailableOnlyChange}
        />
      </div>
      {!open && (
        <ActiveFilters
          {...filters}
          // The chip goes away, so keep the focus nearby rather than lose it.
          onTurnedOff={() => button.current?.focus()}
        />
      )}
    </>
  );
}

type ActiveFiltersProps = Omit<BoardFiltersProps, 'children' | 'members'> & {
  onTurnedOff: () => void;
};

/** A chip for each filter that is on, which turns it off. */
function ActiveFilters({
  currentUserId,
  due,
  onDueChange,
  availableOnly,
  onAvailableOnlyChange,
  picker,
  onPickerChange,
  onTurnedOff,
}: ActiveFiltersProps) {
  const messages = useMessages();
  const t = messages.tasks.board;
  const active: { key: string; label: string; turnOff: () => void }[] = [];
  if (due !== 'all') {
    active.push({
      key: 'due',
      label: t.filters[due],
      turnOff: () => {
        onDueChange('all');
      },
    });
  }
  if (availableOnly) {
    active.push({
      key: 'available',
      label: t.available,
      turnOff: () => {
        onAvailableOnlyChange(false);
      },
    });
  }
  if (picker !== null) {
    active.push({
      key: 'who',
      label: pickerName(picker, currentUserId, messages),
      turnOff: () => {
        onPickerChange(null);
      },
    });
  }
  if (active.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {active.map(({ key, label, turnOff }) => (
        <button
          key={key}
          type="button"
          aria-label={t.removeFilter(label)}
          onClick={() => {
            turnOff();
            onTurnedOff();
          }}
          className="bg-brand-900 flex min-h-11 items-center gap-1 rounded-full pr-3 pl-4 text-sm font-bold text-white"
        >
          {label}
          <CloseIcon className="size-4" />
        </button>
      ))}
    </div>
  );
}
