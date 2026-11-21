interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** An on/off switch with its label before it, big enough to tap: a check box shown as a sliding knob. */
export function Switch({ label, checked, onChange, disabled = false }: SwitchProps) {
  return (
    <label className="text-ink flex min-h-11 shrink-0 cursor-pointer items-center gap-3 text-sm font-medium">
      {label}
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="bg-line-strong peer-checked:bg-brand-600 peer-focus-visible:outline-brand-600 relative h-7 w-12 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-disabled:opacity-60 peer-checked:[&>span]:translate-x-5"
      >
        <span className="bg-surface shadow-card absolute top-0.5 left-0.5 size-6 rounded-full transition-transform" />
      </span>
    </label>
  );
}
