import { DndContext, DragOverlay } from '@dnd-kit/core';
import { useRef, useState } from 'react';

import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { DayNavigation } from '@/features/tasks/DayNavigation';
import { NotScheduledList } from '@/features/tasks/NotScheduledList';
import {
  atMinutes,
  DEFAULT_DURATION_MINUTES,
  daysShown,
  type ScheduleView as View,
  suggestedStart,
} from '@/features/tasks/schedule';
import { ScheduleForm } from '@/features/tasks/ScheduleForm';
import type { Task } from '@/features/tasks/task';
import { type ScheduledTask, Timetable } from '@/features/tasks/Timetable';
import { useSchedules, useSetSchedule } from '@/features/tasks/useSchedules';
import { useTimetableDrag } from '@/features/tasks/useTimetableDrag';
import { today } from '@/lib/dates';
import { useMessages } from '@/lib/i18n/i18n';

interface ScheduleViewProps {
  view: View;
  /** The user's tasks to do. */
  tasks: Task[];
  currentUserId: string;
}

/** Where a task scheduled with its form goes by default: today if it is shown, else the first day shown. */
function firstDayToPlan(days: string[]): string {
  const todayDate = today();
  return days.includes(todayDate) ? todayDate : (days[0] ?? todayDate);
}

/**
 * The user's tasks to do in a timetable of a day or a week, which they plan by dragging tasks into it or
 * with a form (ADR 0004). Only they see it.
 */
export function ScheduleView({ view, tasks, currentUserId }: ScheduleViewProps) {
  const schedules = useSchedules(currentUserId);
  const setSchedule = useSetSchedule(currentUserId);
  const [shownDay, setShownDay] = useState(today);
  // The task whose form is open, and the control that opened it, to give focus back to.
  const [editingId, setEditingId] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const drag = useTimetableDrag((task, startsAt, durationMinutes) => {
    setSchedule.mutate({ taskId: task.id, startsAt: startsAt.toISOString(), durationMinutes });
  });
  const t = useMessages();
  const days = daysShown(view, shownDay);

  if (schedules.isPending) return <LoadingMessage />;
  if (schedules.isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {t.schedule.loadFailed}
      </p>
    );
  }

  const scheduleOf = new Map(schedules.data.map((schedule) => [schedule.taskId, schedule]));
  const scheduled: ScheduledTask[] = tasks.flatMap((task) => {
    const schedule = scheduleOf.get(task.id);
    return schedule ? [{ ...schedule, task }] : [];
  });
  const editing = tasks.find((task) => task.id === editingId);
  const editingSchedule = editing && scheduleOf.get(editing.id);

  function openForm(taskId: string, control: HTMLElement) {
    if (drag.wasJustDragged()) return;
    opener.current = control;
    setEditingId(taskId);
  }

  function closeForm() {
    setEditingId(null);
    // Once the form has gone; a block keeps its button when it moves.
    setTimeout(() => {
      if (opener.current?.isConnected) opener.current.focus();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600">{t.schedule.description}</p>
      <DayNavigation view={view} days={days} onShow={setShownDay} />
      <DndContext sensors={drag.sensors} {...drag.handlers}>
        <Timetable
          days={days}
          scheduled={scheduled}
          dragged={drag.dragged}
          target={drag.target}
          scrollerRef={drag.scrollerRef}
          columnRef={drag.columnRef}
          onOpen={openForm}
        />
        {setSchedule.isError && (
          <p role="alert" className="text-sm text-red-700">
            {t.schedule.moveFailed}
          </p>
        )}
        <p aria-live="polite" className="sr-only">
          {drag.announcement}
        </p>
        {editing && (
          <ScheduleForm
            key={editing.id}
            task={editing}
            currentUserId={currentUserId}
            initial={
              editingSchedule ?? {
                startsAt: suggestedStart(firstDayToPlan(days), new Date()).toISOString(),
                durationMinutes: DEFAULT_DURATION_MINUTES,
              }
            }
            isScheduled={editingSchedule !== undefined}
            onClose={closeForm}
          />
        )}
        <NotScheduledList
          tasks={tasks.filter((task) => !scheduleOf.has(task.id))}
          onOpen={openForm}
        />
        <DragOverlay dropAnimation={null}>
          {drag.dragged && (
            <div className="bg-brand-50 border-brand-600 text-brand-900 w-36 rounded-md border-l-4 px-2 py-1 text-xs font-semibold shadow-lg">
              <span className="block truncate">{drag.dragged.task.title}</span>
              {drag.target && (
                <span className="block font-normal">
                  {t.common.time(atMinutes(drag.target.day, drag.target.minutes))}
                </span>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
