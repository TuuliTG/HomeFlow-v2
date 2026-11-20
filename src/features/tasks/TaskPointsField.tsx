import { type Ref, useId } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import { MAX_POINTS, NO_POINTS } from '@/features/tasks/task';
import { useMessages } from '@/lib/i18n/i18n';

interface TaskPointsFieldProps {
  /** A child doesn't choose the points of their task: an adult awards them (ADR 0004). */
  isChild: boolean;
  /** An adult's task for children earns each child who does it these points, shown as stars. */
  forChildren: boolean;
  value: string;
  onChange: (points: string) => void;
  inputRef: Ref<HTMLInputElement>;
  errorProps: { 'aria-invalid': boolean; 'aria-describedby': string | undefined };
}

/**
 * The points a shared task earns, 0 for one that counts for nobody; none for a child, whose task an adult awards points to.
 */
export function TaskPointsField({
  isChild,
  forChildren,
  value,
  onChange,
  inputRef,
  errorProps,
}: TaskPointsFieldProps) {
  const t = useMessages().taskForm;
  const hintId = useId();
  if (isChild) return null;
  const isWithoutPoints = value.trim() !== '' && Number(value) === NO_POINTS;
  const describedBy = [errorProps['aria-describedby'], isWithoutPoints && hintId]
    .filter(Boolean)
    .join(' ');
  return (
    <label className="text-ink flex flex-col gap-1 text-sm font-medium">
      {forChildren ? t.stars : t.points}
      <input
        type="number"
        name="points"
        ref={inputRef}
        aria-invalid={errorProps['aria-invalid']}
        aria-describedby={describedBy || undefined}
        inputMode="numeric"
        min={NO_POINTS}
        max={MAX_POINTS}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={`${inputClassName} w-24`}
      />
      {isWithoutPoints && (
        <span id={hintId} className="text-ink-muted font-normal">
          {t.noPointsHint}
        </span>
      )}
    </label>
  );
}
