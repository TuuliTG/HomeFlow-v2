import { type CSSProperties, useEffect, useState } from 'react';

import { StarIcon } from '@/components/ui/icons';
import { useAsksWhoHelped } from '@/features/tasks/useHelpers';
import { useLastDoneTask } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

/** How long the celebration lasts; the longest animation in `index.css` (`float-up`). */
export const CELEBRATION_DURATION_MS = 1200;

const STAR_COLOURS = ['text-points-400', 'text-brand-600', 'text-meta-500'];

/** Where each star flies to: evenly around the centre, alternately near and far. */
const STARS = Array.from({ length: 10 }, (_, index) => {
  const angle = (index / 10) * 2 * Math.PI;
  const distance = index % 2 === 0 ? 110 : 80;
  const style: CSSProperties & Record<`--star-${string}`, string> = {
    '--star-x': `${String(Math.round(Math.cos(angle) * distance))}px`,
    '--star-y': `${String(Math.round(Math.sin(angle) * distance))}px`,
    '--star-spin': `${String(index % 2 === 0 ? 90 : -90)}deg`,
  };
  return { id: `star-${String(index)}`, style, colour: STAR_COLOURS[index % STAR_COLOURS.length] };
});

/**
 * A short burst of stars, and the points earned floating up, right after the user marks a task done.
 * Only once the completion is saved, so a failed save is never celebrated. It is decorative and never
 * blocks a tap; screen readers hear "<task> done!" instead, unless the who-helped prompt already says
 * so. With reduced motion, the points (or a tick) just show for a moment, without stars.
 */
export function TaskCelebration() {
  const user = useLoggedInUser();
  const last = useLastDoneTask();
  const asksWhoHelped = useAsksWhoHelped(user.id, last?.task);
  // Tasks done before this mounted aren't celebrated again.
  const [endedAt, setEndedAt] = useState(() => last?.at ?? 0);
  const celebration = last && last.at > endedAt ? last : undefined;
  const t = useMessages().tasks.celebration;

  useEffect(() => {
    if (!celebration) return;
    const timer = setTimeout(() => {
      setEndedAt(celebration.at);
    }, CELEBRATION_DURATION_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [celebration]);

  return (
    <>
      <p role="status" className="sr-only">
        {celebration && !asksWhoHelped && (
          <span key={celebration.at}>{t.done(celebration.task.title)}</span>
        )}
      </p>
      {celebration && <StarBurst key={celebration.at} points={celebration.task.points} />}
    </>
  );
}

/** Stars flying out from the centre of the screen around the points earned, or a tick. */
function StarBurst({ points }: { points: number | null }) {
  const { common, tasks } = useMessages();
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center"
    >
      <div className="relative">
        {STARS.map(({ id, style, colour }) => (
          <StarIcon
            key={id}
            style={style}
            fill="currentColor"
            className={`animate-star-burst absolute top-1/2 left-1/2 size-6 motion-reduce:hidden ${colour}`}
          />
        ))}
        <span className="animate-float-up bg-brand-600 block rounded-full px-4 py-2 text-lg font-bold text-white shadow-lg motion-reduce:animate-none">
          {points !== null && points > 0
            ? tasks.celebration.pointsEarned(common.points(points))
            : '✓'}
        </span>
      </div>
    </div>
  );
}
