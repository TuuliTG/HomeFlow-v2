import { useEffect, useRef } from 'react';
import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { type ScheduleView, atMinutes, DEFAULT_DURATION_MINUTES } from '@/features/tasks/schedule';
import type { Task } from '@/features/tasks/task';
import { typeColours } from '@/features/tasks/typeColours';
import { useSetSchedule } from '@/features/tasks/useSchedules';
import { useMessages } from '@/lib/i18n/i18n';

/** A time the user tapped in the timetable: a day and minutes into it. */
export interface Slot {
  day: string;
  minutes: number;
}

interface SlotPickerProps {
  slot: Slot;
  view: ScheduleView;
  /** The user's tasks not in the timetable yet. */
  tasks: Task[];
  currentUserId: string;
  onClose: () => void;
}

/** What to do at a time the user tapped: one of their tasks not scheduled yet, or a new task. */
export function SlotPicker({ slot, view, tasks, currentUserId, onClose }: SlotPickerProps) {
  const setSchedule = useSetSchedule(currentUserId);
  const heading = useRef<HTMLHeadingElement>(null);
  const t = useMessages();
  const startsAt = atMinutes(slot.day, slot.minutes);
  const when = t.schedule.at(t.common.shortDate(startsAt), t.common.time(startsAt));

  useEffect(() => {
    heading.current?.focus();
  }, [slot]);

  return (
    <section
      aria-labelledby="slot-picker-heading"
      className="bg-surface shadow-card flex flex-col gap-3 rounded-2xl p-4 text-sm"
    >
      <h3
        ref={heading}
        id="slot-picker-heading"
        tabIndex={-1}
        className="text-ink font-semibold focus:outline-none"
      >
        {when}
      </h3>
      {tasks.length > 0 && (
        <ul aria-label={t.schedule.placeHere} className="flex flex-wrap gap-2">
          {tasks.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                disabled={setSchedule.isPending}
                onClick={() => {
                  setSchedule.mutate(
                    {
                      taskId: task.id,
                      startsAt: startsAt.toISOString(),
                      durationMinutes: DEFAULT_DURATION_MINUTES,
                    },
                    { onSuccess: onClose },
                  );
                }}
                className={`flex min-h-11 items-center rounded-lg border-l-4 px-3 text-left font-semibold disabled:opacity-60 ${typeColours[task.type]}`}
              >
                {task.title}
              </button>
            </li>
          ))}
        </ul>
      )}
      {setSchedule.isError && (
        <p role="alert" className="text-danger-700 text-xs">
          {t.schedule.saveFailed}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to={paths.newTaskAt(startsAt.toISOString(), view)}
          className="text-brand-900 flex min-h-11 items-center font-semibold hover:underline"
        >
          {t.schedule.addNewTask}
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="border-line-strong bg-surface text-ink hover:bg-page rounded-lg border px-3 py-1.5 font-semibold"
        >
          {t.common.cancel}
        </button>
      </div>
    </section>
  );
}
