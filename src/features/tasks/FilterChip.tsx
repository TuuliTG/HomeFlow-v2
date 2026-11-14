import { chipClassName } from '@/features/tasks/chipStyles';

interface FilterChipProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** A filter on the board that one tap turns on and another off. */
export function FilterChip({ label, checked, onChange }: FilterChipProps) {
  return (
    <label className={chipClassName}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        className="sr-only"
      />
      {label}
    </label>
  );
}
