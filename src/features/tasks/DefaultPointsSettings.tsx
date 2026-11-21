import { useId } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import { useDefaultPoints } from '@/features/tasks/defaultPoints';
import { MAX_POINTS, NO_POINTS } from '@/features/tasks/task';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

const pointChoices = Array.from({ length: MAX_POINTS - NO_POINTS + 1 }, (_, i) => NO_POINTS + i);

/** In an adult's settings: the points their new tasks start with, remembered on this device. */
export function DefaultPointsSettings() {
  const user = useLoggedInUser();
  const [points, setPoints] = useDefaultPoints(user.id);
  const t = useMessages().taskForm.defaultPoints;
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="bg-surface shadow-card mt-6 flex flex-col gap-3 rounded-2xl p-4"
    >
      <h2 id={headingId} className="text-ink font-semibold">
        {t.heading}
      </h2>
      <label className="text-ink flex flex-col gap-1 text-sm font-medium">
        {t.label}
        <select
          value={points}
          onChange={(event) => {
            setPoints(Number(event.target.value));
          }}
          className={`${inputClassName} w-fit`}
        >
          {pointChoices.map((choice) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
