import { type CSSProperties, useEffect, useState } from 'react';

import { useLastClaimedGoal } from '@/features/rewards/useGoals';
import { useMessages } from '@/lib/i18n/i18n';

/** How long the celebration lasts; the longest animation in `index.css` (`reward-pop`). */
export const CLAIM_CELEBRATION_DURATION_MS = 3000;

const CONFETTI_COLOURS = [
  'bg-amber-400',
  'bg-brand-600',
  'bg-meta-500',
  'bg-emerald-500',
  'bg-rose-400',
  'bg-sky-400',
];

/**
 * Confetti spread across the width of the screen, falling at different times and speeds, drifting and
 * spinning either way. Every piece lands within `CLAIM_CELEBRATION_DURATION_MS`.
 */
const CONFETTI = Array.from({ length: 40 }, (_, index) => {
  const style: CSSProperties & Record<`--confetti-${string}`, string> = {
    left: `${String((index * 37) % 100)}%`,
    animationDelay: `${String(((index * 7) % 5) * 100)}ms`,
    animationDuration: `${String(1800 + ((index * 13) % 7) * 100)}ms`,
    '--confetti-drift': `${String(((index % 5) - 2) * 30)}px`,
    '--confetti-spin': `${String((index % 2 === 0 ? 1 : -1) * (360 + index * 20))}deg`,
  };
  const shape = index % 3 === 0 ? 'size-2.5 rounded-full' : 'h-3.5 w-2 rounded-xs';
  return {
    id: `confetti-${String(index)}`,
    style,
    className: `${shape} ${CONFETTI_COLOURS[index % CONFETTI_COLOURS.length]}`,
  };
});

/**
 * Confetti raining down, and a badge naming the reward, right after the user claims a reward. Only once
 * the claim is saved, so a failed claim (e.g. someone else claimed it first) is never celebrated. It is
 * decorative and never blocks a tap; screen readers hear "Reward claimed: <reward>!" instead. With
 * reduced motion, the badge just shows for a moment, without confetti.
 */
export function RewardCelebration() {
  const last = useLastClaimedGoal();
  // Rewards claimed before this mounted aren't celebrated again.
  const [endedAt, setEndedAt] = useState(() => last?.at ?? 0);
  const celebration = last && last.at > endedAt ? last : undefined;
  const t = useMessages().rewards.celebration;

  useEffect(() => {
    if (!celebration) return;
    const timer = setTimeout(() => {
      setEndedAt(celebration.at);
    }, CLAIM_CELEBRATION_DURATION_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [celebration]);

  return (
    <>
      <p role="status" className="sr-only">
        {celebration && <span key={celebration.at}>{t.claimed(celebration.goal.title)}</span>}
      </p>
      {celebration && <Confetti key={celebration.at} title={celebration.goal.title} />}
    </>
  );
}

/** Confetti falling over the whole screen around a badge in its centre. */
function Confetti({ title }: { title: string }) {
  const t = useMessages().rewards.celebration;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center overflow-hidden px-4"
    >
      {CONFETTI.map(({ id, style, className }) => (
        <span
          key={id}
          style={style}
          className={`animate-confetti-fall absolute top-0 motion-reduce:hidden ${className}`}
        />
      ))}
      <div className="animate-reward-pop flex max-w-xs flex-col items-center gap-1 rounded-2xl bg-emerald-700 px-6 py-4 text-center text-white shadow-xl motion-reduce:animate-none">
        <span className="text-4xl">🎉</span>
        <span className="text-lg font-bold">{t.badge}</span>
        <span className="font-medium break-words">{title}</span>
      </div>
    </div>
  );
}
