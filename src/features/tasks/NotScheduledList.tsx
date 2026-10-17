import { useDraggable } from '@dnd-kit/core';

import { describeDueDate } from '@/features/tasks/dueDate';
import { DEFAULT_DURATION_MINUTES } from '@/features/tasks/schedule';
import type { Task } from '@/features/tasks/task';
import type { OpenForm } from '@/features/tasks/Timetable';
import { typeColours } from '@/features/tasks/typeColours';
import type { DragData } from '@/features/tasks/useTimetableDrag';
import { today } from '@/lib/dates';
import { useMessages } from '@/lib/i18n/i18n';

/** The user's tasks to do that aren't in the timetable yet, to drag into it or schedule with a form. */
export function NotScheduledList({ tasks, onOpen }: { tasks: Task[]; onOpen: OpenForm }) {
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
        <p className="text-sm text-slate-600">{t.allScheduled}</p>
      ) : (
        <>
          <p className="text-xs text-slate-600">{t.dragHint}</p>
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
              <NotScheduledItem key={task.id} task={task} onOpen={onOpen} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function NotScheduledItem({ task, onOpen }: { task: Task; onOpen: OpenForm }) {
  const t = useMessages();
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: task.id,
    data: { task, durationMinutes: DEFAULT_DURATION_MINUTES } satisfies DragData,
  });
  return (
    <li
      ref={setNodeRef}
      {...listeners}
      aria-label={task.title}
      className={[
        'flex cursor-grab touch-manipulation items-center justify-between gap-3 rounded-xl border-l-4 px-3 py-1 text-sm select-none',
        typeColours[task.type],
        isDragging ? 'opacity-40' : '',
      ].join(' ')}
    >
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold break-words">{task.title}</span>
        {task.dueOn !== null && (
          <span className="text-xs">{describeDueDate(task.dueOn, today(), t)}</span>
        )}
      </span>
      <button
        type="button"
        aria-label={t.schedule.scheduleLabel(task.title)}
        onClick={(event) => {
          onOpen(task.id, event.currentTarget);
        }}
        className="flex min-h-11 shrink-0 items-center rounded-lg px-2 font-semibold underline-offset-2 hover:underline"
      >
        {t.schedule.schedule}
      </button>
    </li>
  );
}
