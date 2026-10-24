interface ChoiceChipsProps<T extends string> {
  /** What is being chosen, shown before the chips. */
  legend: string;
  /** The radio group's name, unique on the page. */
  name: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** One tap to pick one of a few options, as a row of chips (radio buttons underneath). */
export function ChoiceChips<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: ChoiceChipsProps<T>) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">{legend}</legend>
      <span aria-hidden="true" className="text-ink-muted text-sm font-semibold">
        {legend}:
      </span>
      {options.map((option) => (
        <label
          key={option.value}
          className="has-checked:bg-brand-900 has-focus-visible:outline-brand-600 bg-surface text-brand-900 shadow-card hover:bg-brand-50 flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm font-semibold has-checked:font-bold has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => {
              onChange(option.value);
            }}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
