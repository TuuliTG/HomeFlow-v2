import { type ReactNode, type Ref, useId } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import { MinusIcon, PlusIcon } from '@/components/ui/icons';
import { Switch } from '@/components/ui/Switch';
import { CheckboxField } from '@/features/tasks/CheckboxField';
import { MAX_DAILY_LIMIT } from '@/features/tasks/task';
import { TaskRepeatField } from '@/features/tasks/TaskRepeatField';
import { CUSTOM_REPEAT, type RepeatFieldValue } from '@/features/tasks/taskRepeat';
import { useMessages } from '@/lib/i18n/i18n';

interface ScheduleFieldsProps {
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
}

/** The daily limit field's value: times a day as typed, or no limit. */
interface DailyLimitValue {
  times: string;
  noLimit: boolean;
}

interface DailyLimitFieldProps {
  value: DailyLimitValue;
  onChange: (value: DailyLimitValue) => void;
  inputRef?: Ref<HTMLInputElement>;
  errorProps?: { 'aria-invalid': boolean; 'aria-describedby': string | undefined };
}

/**
 * How many times a day an always task earns its points: a labelled number between "one fewer" and "one more"
 * buttons that stay within 1 to the most, with a "No limit" switch beside it; the number keeps its value while
 * switched off.
 */
export function DailyLimitField({ value, onChange, inputRef, errorProps }: DailyLimitFieldProps) {
  const t = useMessages().taskForm;
  const id = useId();
  const times = Number.parseInt(value.times, 10);
  const step = (by: number) => {
    const next = Number.isNaN(times) ? 1 : Math.min(Math.max(times + by, 1), MAX_DAILY_LIMIT);
    onChange({ ...value, times: String(next) });
  };
  return (
    <div>
      <label htmlFor={id} className="text-ink mb-2 block text-sm font-medium">
        {t.dailyLimit}
      </label>
      <div className="flex items-center justify-between gap-3">
        <div
          className={`border-line-strong bg-surface has-[input:focus]:border-brand-600 has-[input:focus]:ring-brand-600 flex items-center rounded-xl border has-[input:focus]:ring-1 ${value.noLimit ? 'opacity-50' : ''}`}
        >
          <StepButton
            label={t.dailyLimitFewer}
            disabled={value.noLimit}
            onClick={() => {
              step(-1);
            }}
          >
            <MinusIcon className="size-5" />
          </StepButton>
          <input
            id={id}
            type="number"
            name="dailyLimit"
            ref={inputRef}
            {...errorProps}
            inputMode="numeric"
            min={1}
            max={MAX_DAILY_LIMIT}
            disabled={value.noLimit}
            value={value.times}
            onChange={(event) => {
              onChange({ ...value, times: event.target.value });
            }}
            className="text-ink w-10 [appearance:textfield] bg-transparent text-center text-base focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <StepButton
            label={t.dailyLimitMore}
            disabled={value.noLimit}
            onClick={() => {
              step(1);
            }}
          >
            <PlusIcon className="size-5" />
          </StepButton>
          {/* A screen reader hears only the button's name, so the number it changed is read out here. */}
          <span aria-live="polite" className="sr-only">
            {value.times}
          </span>
        </div>
        <Switch
          label={t.noLimit}
          checked={value.noLimit}
          onChange={(noLimit) => {
            onChange({ ...value, noLimit });
          }}
        />
      </div>
    </div>
  );
}

/** An icon button at either end of the daily limit's number. */
function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="text-brand-700 focus-visible:outline-brand-600 flex size-11 items-center justify-center rounded-xl focus-visible:outline-2"
    >
      {children}
    </button>
  );
}

/** Whether it is done already, how often it repeats, when it is due and whether it is a routine. */
export function ScheduleFields({
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
}: ScheduleFieldsProps) {
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
