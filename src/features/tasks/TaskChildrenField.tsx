import type { RefObject } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import { useHouseholdChildren } from '@/features/tasks/useHelpers';
import { useMessages } from '@/lib/i18n/i18n';

interface TaskChildrenFieldProps {
  currentUserId: string;
  /** A new task can be added for several children, one copy each; a task being edited is one child's. */
  canChooseSeveral: boolean;
  /** The children whose chore it is; none until chosen. */
  value: string[];
  onChange: (childIds: string[]) => void;
  /** The first tick box, focused when none is ticked. */
  firstRef: RefObject<HTMLInputElement | null>;
  errorProps: { 'aria-invalid': boolean; 'aria-describedby': string | undefined };
}

/** Whose chore a task for children is: a new task's chosen children's, or an edited task's child's (ADR 0004). */
export function TaskChildrenField({
  currentUserId,
  canChooseSeveral,
  value,
  onChange,
  firstRef,
  errorProps,
}: TaskChildrenFieldProps) {
  const children = useHouseholdChildren(currentUserId);
  const { common, taskForm: t } = useMessages();
  if (children.length === 0) return null;

  if (!canChooseSeveral) {
    return (
      <label className="text-ink flex flex-col gap-1 text-sm font-medium">
        {t.assignedTo}
        <select
          name="assignedTo"
          value={value[0] ?? ''}
          onChange={(event) => {
            onChange([event.target.value]);
          }}
          className={inputClassName}
        >
          {value.length === 0 && <option value="" disabled hidden />}
          {children.map((child) => (
            <option key={child.id} value={child.id}>
              {child.name ?? common.someone}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <fieldset aria-label={t.whichChildren} className="flex flex-col gap-1">
      {children.map((child, index) => (
        <label
          key={child.id}
          className="text-ink flex min-h-11 items-center gap-3 text-base font-medium"
        >
          <input
            ref={index === 0 ? firstRef : undefined}
            {...errorProps}
            type="checkbox"
            name="children"
            value={child.id}
            checked={value.includes(child.id)}
            onChange={(event) => {
              onChange(
                event.target.checked ? [...value, child.id] : value.filter((id) => id !== child.id),
              );
            }}
            className="accent-brand-600 size-5"
          />
          {child.name ?? common.someone}
        </label>
      ))}
    </fieldset>
  );
}
