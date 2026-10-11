import { useState } from 'react';

interface SavingCheckboxProps {
  label: string;
  /** Names the choice for screen readers, e.g. with whose it is. */
  ariaLabel: string;
  checked: boolean;
  disabled: boolean;
  /** Saves the choice, settling once the saved value has loaded (a failure shows elsewhere). */
  onChange: (checked: boolean) => Promise<void>;
}

/**
 * A check mark whose new value shows straight away, in the same render as the tap, and the saved one
 * again once saving settles.
 */
export function SavingCheckbox({
  label,
  ariaLabel,
  checked,
  disabled,
  onChange,
}: SavingCheckboxProps) {
  /** The choice being saved; null once the saved one has loaded. */
  const [saving, setSaving] = useState<boolean | null>(null);
  return (
    <label className="flex shrink-0 items-center gap-2 text-sm font-medium text-slate-700">
      <input
        type="checkbox"
        aria-label={ariaLabel}
        checked={saving ?? checked}
        disabled={disabled}
        onChange={(event) => {
          setSaving(event.target.checked);
          void onChange(event.target.checked).finally(() => {
            setSaving(null);
          });
        }}
        className="accent-brand-600 size-4"
      />
      {label}
    </label>
  );
}
