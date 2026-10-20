interface CheckboxFieldProps {
  name: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** A check mark with its label, for a yes-or-no choice on the task form. */
export function CheckboxField({ name, label, checked, onChange }: CheckboxFieldProps) {
  return (
    <label className="text-ink flex items-center gap-2 text-sm font-medium">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        className="accent-brand-600 size-4"
      />
      {label}
    </label>
  );
}
