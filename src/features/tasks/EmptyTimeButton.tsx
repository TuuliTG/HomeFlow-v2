import { minutesIntoDay, suggestedStart, tappedStart } from '@/features/tasks/schedule';
import type { PickSlot } from '@/features/tasks/Timetable';
import { PX_PER_MINUTE } from '@/features/tasks/useTimetableDrag';

interface EmptyTimeButtonProps {
  day: string;
  label: string;
  onPickSlot: PickSlot;
}

/**
 * The empty part of a day's column, under its blocks: a tap plans a task at the time tapped, and a key
 * press (no pointer position) at a suggested time.
 */
export function EmptyTimeButton({ day, label, onPickSlot }: EmptyTimeButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        const isTap = event.detail > 0;
        const minutes = isTap
          ? tappedStart(
              (event.clientY - event.currentTarget.getBoundingClientRect().top) / PX_PER_MINUTE,
            )
          : minutesIntoDay(suggestedStart(day, new Date()));
        onPickSlot({ day, minutes }, event.currentTarget);
      }}
      className="hover:bg-brand-50/50 focus-visible:outline-brand-600 absolute inset-0 cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2"
    />
  );
}
