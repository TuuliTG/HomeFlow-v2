import { useDraggable } from '@dnd-kit/core';

import { describeDueDate } from '@/features/tasks/dueDate';
import { DEFAULT_DURATION_MINUTES } from '@/features/tasks/schedule';
import type { Task } from '@/features/tasks/task';
import type { OpenTask } from '@/features/tasks/Timetable';
import { typeColours } from '@/features/tasks/typeColours';
import type { DragData } from '@/features/tasks/useTimetableDrag';
import { today } from '@/lib/dates';
import { useMessages } from '@/lib/i18n/i18n';

/**
 * The user's tasks to do that aren't in the timetable yet, as chips above it, to tap for a form or drag into
 * it.
 */
export function NotScheduledList({
  tasks,
  hasScheduled,
  onOpen,
}: {
  tasks: Task[];
  /** Whether any of the user's tasks are in the timetable. */
  hasScheduled: boolean;
  onOpen: OpenTask;
}) {
  const t = useMessages().schedule;
  return (
    <section aria-labelledby="not-scheduled-heading" className="flex flex-col gap-2">
      <h3
        id="not-scheduled-heading"
        className="text-sm font-semibold tracking-wide text-slate-600 uppercase"
      >
        {t.notScheduled}
      </h3>
      {tasks.length === 0 ? (
        <p className="text-sm text-slate-600">{hasScheduled ? t.allScheduled : t.nothingToPlan}</p>
      ) : (
        <>
          <p className="text-xs text-slate-600">{t.dragHint}</p>
          <ul className="flex flex-wrap gap-2">
            {tasks.map((task) => (
              <NotScheduledChip key={task.id} task={task} onOpen={onOpen} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function NotScheduledChip({ task, onOpen }: { task: Task; onOpen: OpenTask }) {
  const t = useMessages();
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: task.id,
    data: { task, durationMinutes: DEFAULT_DURATION_MINUTES } satisfies DragData,
  });
  return (
    <li className="max-w-full">
      <button
        ref={setNodeRef}
        type="button"
        {...listeners}
        aria-label={t.schedule.scheduleLabel(task.title)}
        onClick={(event) => {
          onOpen(task.id, event.currentTarget);
        }}
        className={[
          'flex min-h-11 max-w-full cursor-grab touch-manipulation flex-col items-start justify-center rounded-lg border-l-4 px-3 py-1 text-left text-sm select-none',
          typeColours[task.type],
          isDragging ? 'opacity-40' : '',
        ].join(' ')}
      >
        <span className="font-semibold break-words">{task.title}</span>
        {task.dueOn !== null && (
          <span className="text-xs">{describeDueDate(task.dueOn, today(), t)}</span>
        )}
      </button>
    </li>
  );
}
