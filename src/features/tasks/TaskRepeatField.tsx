import type { Ref } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import { repeatChoices } from '@/features/tasks/task';
import {
  CUSTOM_REPEAT,
  type RepeatFieldValue,
  type RepeatUnit,
  repeatUnits,
} from '@/features/tasks/taskRepeat';
import { useMessages } from '@/lib/i18n/i18n';

function unitOf(value: string): RepeatUnit {
  return repeatUnits.find((unit) => unit === value) ?? 'days';
}

interface RepeatFieldProps {
  value: RepeatFieldValue;
  onChange: (repeat: RepeatFieldValue) => void;
}

/** How often a task repeats: not at all, a ready-made choice, or a custom interval (`CustomRepeatField`). */
export function RepeatChoiceField({ value, onChange }: RepeatFieldProps) {
  const t = useMessages();
  return (
    <label className="text-ink flex flex-1 flex-col gap-1 text-sm font-medium">
      {t.taskForm.repeats}
      <select
        name="repeatEveryDays"
        value={value.choice}
        onChange={(event) => {
          onChange({ ...value, choice: event.target.value });
        }}
        className={inputClassName}
      >
        <option value="">{t.taskForm.doesNotRepeat}</option>
        {repeatChoices.map((days) => (
          <option key={days} value={days}>
            {t.tasks.repeat(days)}
          </option>
        ))}
        <option value={CUSTOM_REPEAT}>{t.taskForm.customRepeat}</option>
      </select>
    </label>
  );
}

interface CustomRepeatFieldProps extends RepeatFieldProps {
  /** The interval's count, focused when it needs fixing. */
  countRef: Ref<HTMLInputElement>;
  countErrorProps: { 'aria-invalid': boolean; 'aria-describedby': string | undefined };
}

/** A custom interval, every so many days or weeks; shown only when "Custom…" is chosen. */
export function CustomRepeatField({
  value,
  onChange,
  countRef,
  countErrorProps,
}: CustomRepeatFieldProps) {
  const t = useMessages().taskForm;
  if (value.choice !== CUSTOM_REPEAT) return null;
  return (
    <div className="flex items-end gap-2">
      <label className="text-ink flex flex-col gap-1 text-sm font-medium">
        {t.repeatEvery}
        <input
          type="number"
          name="repeatCount"
          ref={countRef}
          {...countErrorProps}
          inputMode="numeric"
          min={1}
          value={value.count}
          onChange={(event) => {
            onChange({ ...value, count: event.target.value });
          }}
          className={`${inputClassName} w-24`}
        />
      </label>
      <select
        name="repeatUnit"
        aria-label={t.repeatUnit}
        value={value.unit}
        onChange={(event) => {
          onChange({ ...value, unit: unitOf(event.target.value) });
        }}
        className={inputClassName}
      >
        {repeatUnits.map((unit) => (
          <option key={unit} value={unit}>
            {t.repeatUnits[unit]}
          </option>
        ))}
      </select>
    </div>
  );
}
