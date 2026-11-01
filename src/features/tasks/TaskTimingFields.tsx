import type { Ref } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import { repeatChoices } from '@/features/tasks/task';
import { useMessages } from '@/lib/i18n/i18n';

interface TaskTimingFieldsProps {
  /** Days between occurrences, or '' for a one-off task. */
  repeat: string;
  onRepeatChange: (repeat: string) => void;
  dueOn: string;
  onDueOnChange: (dueOn: string) => void;
  dueOnRef: Ref<HTMLInputElement>;
  dueOnErrorProps: { 'aria-invalid': boolean; 'aria-describedby': string | undefined };
}

/** When a task is to be done: how often it repeats and when it is due. */
export function TaskTimingFields({
  repeat,
  onRepeatChange,
  dueOn,
  onDueOnChange,
  dueOnRef,
  dueOnErrorProps,
}: TaskTimingFieldsProps) {
  const t = useMessages();
  return (
    <div className="flex gap-3">
      <label className="text-ink flex flex-1 flex-col gap-1 text-sm font-medium">
        {t.taskForm.repeats}
        <select
          name="repeatEveryDays"
          value={repeat}
          onChange={(event) => {
            onRepeatChange(event.target.value);
          }}
          className={inputClassName}
        >
          <option value="">{t.taskForm.doesNotRepeat}</option>
          {repeatChoices.map((days) => (
            <option key={days} value={days}>
              {t.tasks.repeat(days)}
            </option>
          ))}
        </select>
      </label>
      <label className="text-ink flex flex-1 flex-col gap-1 text-sm font-medium">
        {t.taskForm.dueDate}
        <input
          type="date"
          name="dueOn"
          ref={dueOnRef}
          {...dueOnErrorProps}
          value={dueOn}
          onChange={(event) => {
            onDueOnChange(event.target.value);
          }}
          className={`${inputClassName} min-w-0`}
        />
      </label>
    </div>
  );
}
