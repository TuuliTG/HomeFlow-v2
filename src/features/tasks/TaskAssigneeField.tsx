import { type Ref, useId } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import { useHouseholdMembers } from '@/features/tasks/useHelpers';
import { useMessages } from '@/lib/i18n/i18n';

interface TaskAssigneeFieldProps {
  currentUserId: string;
  /** The child whose chore it is, or null for any child. */
  value: string | null;
  onChange: (assignedTo: string | null) => void;
  /** Whether the task is being added as already done: then it can't be one child's chore. */
  isDone: boolean;
  selectRef: Ref<HTMLSelectElement>;
}

/**
 * Whose chore a task for children is: any child's, or one child's only. Hidden without children. Warns
 * when the task is being added as already done, which credits whoever adds it, so the form won't save it.
 */
export function TaskAssigneeField({
  currentUserId,
  value,
  onChange,
  isDone,
  selectRef,
}: TaskAssigneeFieldProps) {
  const members = useHouseholdMembers(currentUserId);
  const { common, taskForm: t } = useMessages();
  const warningId = useId();
  const children = (members.data ?? []).filter((member) => member.isChild);
  if (children.length === 0) return null;
  const chosen = children.find((child) => child.id === value);
  const warns = isDone && chosen !== undefined;
  return (
    <div className="flex flex-col gap-1">
      <label className="text-ink flex flex-col gap-1 text-sm font-medium">
        {t.assignedTo}
        <select
          name="assignedTo"
          ref={selectRef}
          value={value ?? ''}
          aria-invalid={warns}
          aria-describedby={warns ? warningId : undefined}
          onChange={(event) => {
            onChange(event.target.value === '' ? null : event.target.value);
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
      {warns && (
        <p id={warningId} role="alert" className="text-danger-700 text-sm">
          {t.errors.doneChoreForChild(chosen.name ?? common.someone)}
        </p>
      )}
    </div>
  );
}
