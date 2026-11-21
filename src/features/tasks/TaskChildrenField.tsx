import type { RefObject } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import { useHouseholdChildren } from '@/features/tasks/useHelpers';
import { useMessages } from '@/lib/i18n/i18n';

interface TaskChildrenFieldProps {
  currentUserId: string;
  /** The child whose chore it is; null until chosen. */
  value: string | null;
  onChange: (childId: string) => void;
  /** Focused when the task needs a child chosen. */
  selectRef: RefObject<HTMLSelectElement | null>;
  errorProps: { 'aria-invalid': boolean; 'aria-describedby': string | undefined };
}

/**
 * Whose chore an edited task for children is: every one is a child's (ADR 0004). Asked only when the family has
 * more than one child.
 */
export function TaskChildrenField({
  currentUserId,
  value,
  onChange,
  selectRef,
  errorProps,
}: TaskChildrenFieldProps) {
  const children = useHouseholdChildren(currentUserId);
  const { common, taskForm: t } = useMessages();
  if (children.length <= 1) return null;
  return (
    <label className="text-ink flex flex-col gap-1 text-sm font-medium">
      {t.assignedTo}
      <select
        name="assignedTo"
        ref={selectRef}
        {...errorProps}
        value={value ?? ''}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={inputClassName}
      >
        {value === null && <option value="" disabled hidden />}
        {children.map((child) => (
          <option key={child.id} value={child.id}>
            {child.name ?? common.someone}
          </option>
        ))}
      </select>
    </label>
  );
}
