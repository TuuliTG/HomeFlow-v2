import { type Ref, useId } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import { TaskStarsField } from '@/features/tasks/TaskStarsField';
import { MAX_POINTS, NO_POINTS } from '@/features/tasks/task';
import { useMessages } from '@/lib/i18n/i18n';

interface TaskPointsFieldProps {
  /** A child doesn't choose the points of their task: an adult awards them (ADR 0004). */
  isChild: boolean;
  /** An adult's task for children earns each child who does it these points, picked as stars. */
  forChildren: boolean;
  /** The field's label, if not the usual one, e.g. "Stars" on a form for one child already named. */
  label?: string;
  value: string;
  onChange: (points: string) => void;
  inputRef: Ref<HTMLInputElement>;
  errorProps: { 'aria-invalid': boolean; 'aria-describedby': string | undefined };
}

/**
 * The points a shared task earns, 0 for one that counts for nobody; none for a child, whose task an adult awards points to.
 * A task for children earns stars instead.
 */
export function TaskPointsField({
  isChild,
  forChildren,
  label,
  value,
  onChange,
  inputRef,
  errorProps,
}: TaskPointsFieldProps) {
  const t = useMessages().taskForm;
  const hintId = useId();
  if (isChild) return null;
  if (forChildren) {
    return (
      <TaskStarsField
        label={label}
        value={value}
        onChange={onChange}
        inputRef={inputRef}
        errorProps={errorProps}
      />
    );
  }
  const isWithoutPoints = value.trim() !== '' && Number(value) === NO_POINTS;
  const describedBy = [errorProps['aria-describedby'], isWithoutPoints && hintId]
    .filter(Boolean)
    .join(' ');
  return (
    <label className="text-ink flex flex-col gap-1 text-sm font-medium">
      {t.points}
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
