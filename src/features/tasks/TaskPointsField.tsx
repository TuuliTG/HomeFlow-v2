import type { Ref } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import { MAX_POINTS, MIN_POINTS } from '@/features/tasks/task';
import { useMessages } from '@/lib/i18n/i18n';

interface TaskPointsFieldProps {
  /** A child doesn't choose the points of their task: an adult awards them (ADR 0004). */
  isChild: boolean;
  value: string;
  onChange: (points: string) => void;
  inputRef: Ref<HTMLInputElement>;
  errorProps: { 'aria-invalid': boolean; 'aria-describedby': string | undefined };
}

/** The points a shared task earns; none for a child, whose task an adult awards points to. */
export function TaskPointsField({
  isChild,
  value,
  onChange,
  inputRef,
  errorProps,
}: TaskPointsFieldProps) {
  const t = useMessages().taskForm;
  if (isChild) return null;
  return (
    <label className="text-ink flex flex-col gap-1 text-sm font-medium">
      {t.points}
      <input
        type="number"
        name="points"
        ref={inputRef}
        {...errorProps}
        inputMode="numeric"
        min={MIN_POINTS}
        max={MAX_POINTS}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={`${inputClassName} w-24`}
      />
    </label>
  );
}
