import type { Ref } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import { CheckboxField } from '@/features/tasks/CheckboxField';
import { TaskRepeatField } from '@/features/tasks/TaskRepeatField';
import { CUSTOM_REPEAT, type RepeatFieldValue } from '@/features/tasks/taskRepeat';
import { useMessages } from '@/lib/i18n/i18n';

interface TaskTimingFieldsProps {
  repeat: RepeatFieldValue;
  onRepeatChange: (repeat: RepeatFieldValue) => void;
  repeatCountRef: Ref<HTMLInputElement>;
  repeatCountErrorProps: { 'aria-invalid': boolean; 'aria-describedby': string | undefined };
  dueOn: string;
  onDueOnChange: (dueOn: string) => void;
  dueOnRef: Ref<HTMLInputElement>;
  dueOnErrorProps: { 'aria-invalid': boolean; 'aria-describedby': string | undefined };
  /** "Already done", offered when adding a task; a task done already isn't asked for a due date. */
  alreadyDone: { checked: boolean; onChange: (checked: boolean) => void } | undefined;
}

/** When a task is to be done: whether it is done already, how often it repeats and when it is due. */
export function TaskTimingFields({
  repeat,
  onRepeatChange,
  repeatCountRef,
  repeatCountErrorProps,
  dueOn,
  onDueOnChange,
  dueOnRef,
  dueOnErrorProps,
  alreadyDone,
}: TaskTimingFieldsProps) {
  const t = useMessages();
  return (
    <>
      {alreadyDone && (
        <CheckboxField
          name="isDone"
          label={t.taskForm.alreadyDone}
          checked={alreadyDone.checked}
          onChange={alreadyDone.onChange}
        />
      )}

      {/* A custom interval needs the width, so the due date then goes under it. */}
      <div className={repeat.choice === CUSTOM_REPEAT ? 'flex flex-col gap-3' : 'flex gap-3'}>
        <TaskRepeatField
          value={repeat}
          onChange={onRepeatChange}
          countRef={repeatCountRef}
          countErrorProps={repeatCountErrorProps}
        />
        {!alreadyDone?.checked && (
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
        )}
      </div>
    </>
  );
}
