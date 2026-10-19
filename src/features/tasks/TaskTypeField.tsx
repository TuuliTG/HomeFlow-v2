import { type TaskType, taskTypes } from '@/features/tasks/task';
import { useMessages } from '@/lib/i18n/i18n';

interface TaskTypeFieldProps {
  value: TaskType;
  onChange: (type: TaskType) => void;
}

/** Physical or meta work, as a choice of radio buttons. */
export function TaskTypeField({ value, onChange }: TaskTypeFieldProps) {
  const t = useMessages();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-ink mb-1 text-sm font-medium">{t.taskForm.type}</legend>
      <div className="flex gap-3">
        {taskTypes.map((option) => (
          <label
            key={option}
            className="has-checked:border-brand-600 has-checked:bg-brand-50 border-line-strong bg-surface text-ink flex flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium"
          >
            <input
              type="radio"
              name="type"
              value={option}
              checked={value === option}
              onChange={() => {
                onChange(option);
              }}
              className="accent-brand-600"
            />
            {t.common.taskTypes[option]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
