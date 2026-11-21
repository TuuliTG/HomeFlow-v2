import type { Ref } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import { CheckboxField } from '@/features/tasks/CheckboxField';
import { MAX_DAILY_LIMIT } from '@/features/tasks/task';
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
  alreadyDone: { offered: boolean; checked: boolean; onChange: (checked: boolean) => void };
  /** Whether it is a routine, offered for repeating shared tasks (`canBeRoutine()`). */
  routine: { offered: boolean; checked: boolean; onChange: (checked: boolean) => void };
  /**
   * Whether it is an always task, offered for an adult's task for children, and how many times a day it earns
   * its points (empty for no limit). Checked, it has no schedule, also when not offered (a child's edit).
   */
  always: {
    offered: boolean;
    checked: boolean;
    onChange: (checked: boolean) => void;
    dailyLimit: string;
    onDailyLimitChange: (dailyLimit: string) => void;
  };
}

/**
 * When a task is to be done: always (then only how many times a day), or whether it is done already, how often it
 * repeats, when it is due and whether a repeating task is a routine.
 */
export function TaskTimingFields({ always, ...schedule }: TaskTimingFieldsProps) {
  const t = useMessages();
  return (
    <>
      {always.offered && (
        <CheckboxField
          name="isAlways"
          label={t.taskForm.always}
          checked={always.checked}
          onChange={always.onChange}
        />
      )}
      {always.offered && always.checked && (
        <DailyLimitField value={always.dailyLimit} onChange={always.onDailyLimitChange} />
      )}
      {!always.checked && <ScheduleFields {...schedule} />}
    </>
  );
}

const dailyLimitChoices = Array.from({ length: MAX_DAILY_LIMIT }, (_, index) => index + 1);

/** How many times a day an always task earns its points, or no limit (an empty value). */
function DailyLimitField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useMessages().taskForm;
  return (
    <label className="text-ink flex flex-col gap-1 text-sm font-medium">
      {t.dailyLimit}
      <select
        name="dailyLimit"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={`${inputClassName} w-32`}
      >
        {dailyLimitChoices.map((times) => (
          <option key={times} value={times}>
            {times}
          </option>
        ))}
        <option value="">{t.noLimit}</option>
      </select>
    </label>
  );
}

/** Whether it is done already, how often it repeats, when it is due and whether it is a routine. */
function ScheduleFields({
  repeat,
  onRepeatChange,
  repeatCountRef,
  repeatCountErrorProps,
  dueOn,
  onDueOnChange,
  dueOnRef,
  dueOnErrorProps,
  alreadyDone,
  routine,
}: Omit<TaskTimingFieldsProps, 'always'>) {
  const t = useMessages();
  return (
    <>
      {alreadyDone.offered && (
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
        {!(alreadyDone.offered && alreadyDone.checked) && (
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

      {routine.offered && (
        <CheckboxField
          name="isRoutine"
          label={t.taskForm.routine}
          checked={routine.checked}
          onChange={routine.onChange}
        />
      )}
    </>
  );
}
