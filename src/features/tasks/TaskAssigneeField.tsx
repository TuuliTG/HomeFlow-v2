import { inputClassName } from '@/components/ui/formStyles';
import { useHouseholdMembers } from '@/features/tasks/useHelpers';
import { useMessages } from '@/lib/i18n/i18n';

interface TaskAssigneeFieldProps {
  currentUserId: string;
  /** The child whose chore it is, or null for any child. */
  value: string | null;
  onChange: (assignedTo: string | null) => void;
}

/** Whose chore a task for children is: any child's, or one child's only. Hidden without children. */
export function TaskAssigneeField({ currentUserId, value, onChange }: TaskAssigneeFieldProps) {
  const members = useHouseholdMembers(currentUserId);
  const { common, taskForm: t } = useMessages();
  const children = (members.data ?? []).filter((member) => member.isChild);
  if (children.length === 0) return null;
  return (
    <label className="text-ink flex flex-col gap-1 text-sm font-medium">
      {t.assignedTo}
      <select
        name="assignedTo"
        value={value ?? ''}
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
  );
}
