import type { Ref } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import { useMessages } from '@/lib/i18n/i18n';

interface TaskPointsFieldProps {
  /** A child doesn't choose the points of their task: an adult awards them (ADR 0004). */
  isChild: boolean;
  value: string;
  onChange: (points: string) => void;
  inputRef: Ref<HTMLInputElement>;
  errorProps: { 'aria-invalid': boolean; 'aria-describedby': string | undefined };
}

/** The points a shared task earns, or for a child, who chooses them. */
export function TaskPointsField({
  isChild,
  value,
  onChange,
  inputRef,
  errorProps,
}: TaskPointsFieldProps) {
  const t = useMessages().taskForm;
  if (isChild) return <p className="text-sm text-slate-600">{t.adultAwardsPoints}</p>;
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
      {t.points}
      <input
        type="number"
        name="points"
        ref={inputRef}
        {...errorProps}
        inputMode="numeric"
        min={1}
        max={10}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={`${inputClassName} w-24`}
      />
    </label>
  );
}
