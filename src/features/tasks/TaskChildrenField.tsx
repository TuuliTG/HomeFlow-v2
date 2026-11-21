import { inputClassName } from '@/components/ui/formStyles';
import { useHouseholdChildren } from '@/features/tasks/useHelpers';
import { useMessages } from '@/lib/i18n/i18n';

interface TaskChildrenFieldProps {
  currentUserId: string;
  /** A new task can be added for several children, one copy each; a task being edited is one child's. */
  canChooseSeveral: boolean;
  /** The children whose chore it is; none for any child, which only an edited task can be. */
  value: string[];
  onChange: (childIds: string[]) => void;
}

/**
 * Whose chore a task for children is: a new task's chosen children's, or an edited task's child's or any
 * child's. Hidden without children.
 */
export function TaskChildrenField({
  currentUserId,
  canChooseSeveral,
  value,
  onChange,
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
    <fieldset aria-label={t.whichChildren} className="flex flex-col gap-1">
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
    </fieldset>
  );
}
