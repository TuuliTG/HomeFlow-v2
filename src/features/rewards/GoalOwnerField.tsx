import { inputClassName } from '@/components/ui/formStyles';
import { type GoalSetter, nameOf } from '@/features/rewards/goal';
import { useMessages } from '@/lib/i18n/i18n';

interface GoalOwnerFieldProps {
  members: GoalSetter[];
  /** Members who already have an open personal goal. */
  busy: ReadonlySet<string>;
  userId: string;
  value: string;
  onChange: (ownerId: string) => void;
}

/**
 * Whose personal goal it is: the user's own ("Me") or another member's, e.g. a child's, but not someone
 * who already has one open.
 */
export function GoalOwnerField({ members, busy, userId, value, onChange }: GoalOwnerFieldProps) {
  const messages = useMessages();
  const t = messages.rewards.form;
  if (members.every(({ id }) => busy.has(id))) {
    return <p className="text-sm text-slate-600">{t.everyoneHasOpenGoal}</p>;
  }
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
      {t.whose}
      <select
        name="ownerId"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={`${inputClassName} w-fit`}
      >
        {members.map((member) => {
          const name = member.id === userId ? t.me : nameOf(member, messages);
          const hasGoal = busy.has(member.id);
          return (
            <option key={member.id} value={member.id} disabled={hasGoal}>
              {hasGoal ? t.hasOpenGoal(name) : name}
            </option>
          );
        })}
      </select>
    </label>
  );
}
