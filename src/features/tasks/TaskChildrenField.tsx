import { useId } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import { useHouseholdMembers } from '@/features/tasks/useHelpers';
import { useMessages } from '@/lib/i18n/i18n';

interface TaskChildrenFieldProps {
  currentUserId: string;
  /** A new task can be added for several children, one copy each; a task being edited is one child's. */
  canChooseSeveral: boolean;
  /** The children whose chore it is; none for any child. */
  value: string[];
  onChange: (childIds: string[]) => void;
}

/** Whose chore a task for children is: any child's, or chosen children's. Hidden without children. */
export function TaskChildrenField({
  currentUserId,
  canChooseSeveral,
  value,
  onChange,
}: TaskChildrenFieldProps) {
  const members = useHouseholdMembers(currentUserId);
  const { common, taskForm: t } = useMessages();
  const hintId = useId();
  const children = (members.data ?? []).filter((member) => member.isChild);
  if (children.length === 0) return null;

  if (!canChooseSeveral) {
    return (
      <label className="text-ink flex flex-col gap-1 text-sm font-medium">
        {t.assignedTo}
        <select
          name="assignedTo"
          value={value[0] ?? ''}
          onChange={(event) => {
            onChange(event.target.value === '' ? [] : [event.target.value]);
          }}
          className={inputClassName}
        >
          <option value="">{t.anyChild}</option>
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
    <fieldset aria-describedby={hintId} className="flex flex-col gap-1">
      <legend className="text-ink mb-1 text-sm font-medium">{t.whichChildren}</legend>
      {children.map((child) => (
        <label
          key={child.id}
          className="text-ink flex min-h-11 items-center gap-3 text-base font-medium"
        >
          <input
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
      <p id={hintId} className="text-ink-muted text-sm">
        {t.whichChildrenHint}
      </p>
    </fieldset>
  );
}
