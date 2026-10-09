import { useId } from 'react';

interface PrivateTaskFieldProps {
  checked: boolean;
  onChange: (isPrivate: boolean) => void;
}

/** The check mark that keeps a new task to its creator, without points, instead of sharing it with the family. */
export function PrivateTaskField({ checked, onChange }: PrivateTaskFieldProps) {
  const hintId = useId();
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
        <input
          type="checkbox"
          name="isPrivate"
          aria-describedby={hintId}
          checked={checked}
          onChange={(event) => {
            onChange(event.target.checked);
          }}
          className="accent-brand-600 size-4"
        />
        Keep it private
      </label>
      <p id={hintId} className="text-sm text-slate-600">
        Only you can see it. It isn&apos;t shared with your family and earns no points.
      </p>
    </div>
  );
}
