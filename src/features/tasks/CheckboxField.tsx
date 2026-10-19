import { useId } from 'react';

interface CheckboxFieldProps {
  name: string;
  label: string;
  /** Explains what checking it means, below the check mark. */
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** A check mark with its label and a hint, for a yes-or-no choice on the task form. */
export function CheckboxField({ name, label, hint, checked, onChange }: CheckboxFieldProps) {
  const hintId = useId();
  return (
    <div className="flex flex-col gap-1">
      <label className="text-ink flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name={name}
          aria-describedby={hintId}
          checked={checked}
          onChange={(event) => {
            onChange(event.target.checked);
          }}
          className="accent-brand-600 size-4"
        />
        {label}
      </label>
      <p id={hintId} className="text-ink-muted text-sm">
        {hint}
      </p>
    </div>
  );
}
