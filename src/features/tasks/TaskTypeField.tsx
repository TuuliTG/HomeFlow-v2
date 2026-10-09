import { type TaskType, taskTypeLabels, taskTypes } from '@/features/tasks/task';

interface TaskTypeFieldProps {
  value: TaskType;
  onChange: (type: TaskType) => void;
}

/** Physical or meta work, as a choice of radio buttons. */
export function TaskTypeField({ value, onChange }: TaskTypeFieldProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-slate-700">Type</legend>
      <div className="flex gap-3">
        {taskTypes.map((option) => (
          <label
            key={option}
            className="has-checked:border-brand-600 has-checked:bg-brand-50 flex flex-1 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
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
            {taskTypeLabels[option]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
