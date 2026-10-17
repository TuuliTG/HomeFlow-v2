import { useId } from 'react';

interface SegmentedChoiceProps<T extends string> {
  legend: string;
  /** Show the legend above the options; otherwise it is for screen readers only. */
  showLegend?: boolean;
  options: readonly T[];
  labels: Record<T, string>;
  /** Null when none of the options is chosen. */
  value: T | null;
  onChange: (value: T) => void;
}

/** One of a few options, side by side; the legend is for screen readers unless `showLegend`. */
export function SegmentedChoice<T extends string>({
  legend,
  showLegend = false,
  options,
  labels,
  value,
  onChange,
}: SegmentedChoiceProps<T>) {
  const name = useId();
  return (
    <fieldset>
      <legend className={showLegend ? 'mb-2 text-sm font-medium text-slate-700' : 'sr-only'}>
        {legend}
      </legend>
      <div
        className="grid gap-1 rounded-xl bg-slate-200 p-1 text-sm font-medium"
        style={{ gridTemplateColumns: `repeat(${String(options.length)}, minmax(0, 1fr))` }}
      >
        {options.map((option) => (
          <label
            key={option}
            className="has-checked:text-brand-900 has-focus-visible:outline-brand-600 flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-2 text-center text-slate-600 has-checked:bg-white has-checked:shadow-sm has-focus-visible:outline-2"
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={option === value}
              onChange={() => {
                onChange(option);
              }}
              className="sr-only"
            />
            {labels[option]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
