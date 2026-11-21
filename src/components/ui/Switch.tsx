interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Spans its row, the label at the start and the switch at the end, as in a list of settings. */
  wide?: boolean;
}

/** An on/off switch with its label before it, big enough to tap: a check box shown as a sliding knob. */
export function Switch({ label, checked, onChange, disabled = false, wide = false }: SwitchProps) {
  return (
    <label
      className={`text-ink flex min-h-11 shrink-0 cursor-pointer items-center gap-3 ${wide ? 'w-full justify-between text-base' : 'text-sm'} font-medium`}
    >
      {label}
      {/* The check box lies over the track, invisible but there to tap, so the track shows its state. */}
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.checked);
          }}
          className="peer absolute inset-0 z-10 m-0 cursor-pointer opacity-0 disabled:cursor-default"
        />
        <span
          aria-hidden="true"
          className="bg-line-strong peer-checked:bg-brand-600 peer-focus-visible:outline-brand-600 relative h-7 w-12 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-disabled:opacity-60 peer-checked:[&>span]:translate-x-5"
        >
          <span className="bg-surface shadow-card absolute top-0.5 left-0.5 size-6 rounded-full transition-transform" />
        </span>
      </span>
    </label>
  );
}
