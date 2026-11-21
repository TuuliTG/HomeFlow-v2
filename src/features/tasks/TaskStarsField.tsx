import { type Ref, useId } from 'react';

import { StarIcon } from '@/components/ui/icons';
import { MAX_CHILD_STARS, NO_POINTS } from '@/features/tasks/task';
import { useMessages } from '@/lib/i18n/i18n';

const STAR_CHOICES = Array.from({ length: MAX_CHILD_STARS }, (_, index) => index + 1);

interface TaskStarsFieldProps {
  value: string;
  onChange: (points: string) => void;
  /** The first star, focused when the stars need choosing. */
  inputRef: Ref<HTMLInputElement>;
  errorProps: { 'aria-invalid': boolean; 'aria-describedby': string | undefined };
}

/**
 * The stars each child earns for a task for children: a row of stars, filled up to the one picked. Picking the
 * last filled star again clears them all, for a task worth none.
 */
export function TaskStarsField({ value, onChange, inputRef, errorProps }: TaskStarsFieldProps) {
  const t = useMessages().taskForm;
  const name = useId();
  const labelId = useId();
  // More points than stars (from the default points, say) are saved as the most stars too.
  const stars = value.trim() === '' ? null : Math.min(Number(value), MAX_CHILD_STARS);

  return (
    <div role="radiogroup" aria-labelledby={labelId} {...errorProps}>
      <p id={labelId} className="text-ink mb-1 text-sm font-medium">
        {t.stars}
      </p>
      <div className="-ml-1.5 flex">
        {STAR_CHOICES.map((count) => (
          <label key={count} className="relative cursor-pointer p-1.5">
            <input
              type="radio"
              name={name}
              ref={count === 1 ? inputRef : undefined}
              checked={stars === count}
              onChange={() => {
                onChange(String(count));
              }}
              onClick={() => {
                if (stars === count) onChange(String(NO_POINTS));
              }}
              className="peer sr-only"
            />
            <span className="sr-only">{t.starCount(count)}</span>
            <StarIcon
              className={`peer-focus-visible:outline-brand-600 size-8 rounded peer-focus-visible:outline-2 ${
                stars !== null && count <= stars ? 'text-points-600 fill-current' : 'text-ink-muted'
              }`}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
