import { DndContext, DragOverlay } from '@dnd-kit/core';
import { useRef, useState } from 'react';

import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { DayNavigation } from '@/features/tasks/DayNavigation';
import { NotScheduledList } from '@/features/tasks/NotScheduledList';
import {
  atMinutes,
  DEFAULT_DURATION_MINUTES,
  daysShown,
  endOf,
  type ScheduleView as View,
  suggestedStart,
  type TaskSchedule,
} from '@/features/tasks/schedule';
import { ScheduleForm } from '@/features/tasks/ScheduleForm';
import { type Slot, SlotPicker } from '@/features/tasks/SlotPicker';
import type { Task } from '@/features/tasks/task';
import { TaskCard } from '@/features/tasks/TaskCard';
import { type ScheduledTask, Timetable } from '@/features/tasks/Timetable';
import { useSchedules, useSetSchedule } from '@/features/tasks/useSchedules';
import { type DropTarget, useTimetableDrag } from '@/features/tasks/useTimetableDrag';
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
 * What is open above the timetable: the details of a task tapped in it, a task's form, or what to do at a time
 * tapped in it.
 */
type Panel = { kind: 'details' | 'form'; taskId: string } | ({ kind: 'slot' } & Slot);

/**
 * The user's tasks to do in a timetable of a day or a week, which they plan by dragging tasks into it,
 * tapping a task or an empty time, or with a form (ADR 0004). Only they see it.
 */
export function ScheduleView({ view, tasks, currentUserId }: ScheduleViewProps) {
  const schedules = useSchedules(currentUserId);
  const setSchedule = useSetSchedule(currentUserId);
  const [shownDay, setShownDay] = useState(today);
  // What is open above the timetable, and the control that opened it, to give focus back to.
  const [panel, setPanel] = useState<Panel | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const drag = useTimetableDrag((task, startsAt, durationMinutes) => {
    setSchedule.mutate({ taskId: task.id, startsAt: startsAt.toISOString(), durationMinutes });
  });
  const t = useMessages();
  const days = daysShown(view, shownDay);

  if (schedules.isPending) return <LoadingMessage />;
  if (schedules.isError) {
    return (
      <p role="alert" className="text-danger-700 text-sm">
        {t.schedule.loadFailed}
      </p>
    );
  }

  const scheduleOf = new Map(schedules.data.map((schedule) => [schedule.taskId, schedule]));
  const scheduled: ScheduledTask[] = tasks.flatMap((task) => {
    const schedule = scheduleOf.get(task.id);
    return schedule ? [{ ...schedule, task }] : [];
  });
  const notScheduled = tasks.filter((task) => !scheduleOf.has(task.id));

  function open(next: Panel, control: HTMLElement) {
    if (drag.wasJustDragged()) return;
    opener.current = control;
    setPanel(next);
  }

  function close() {
    setPanel(null);
    // Once the panel has gone; a block keeps its button when it moves.
    setTimeout(() => {
      if (opener.current?.isConnected) opener.current.focus();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <DndContext sensors={drag.sensors} {...drag.handlers}>
        <NotScheduledList
          tasks={notScheduled}
          hasScheduled={scheduled.length > 0}
          onOpen={(taskId, control) => {
            open({ kind: 'form', taskId }, control);
          }}
        />
        {panel && (
          <OpenPanel
            panel={panel}
            view={view}
            days={days}
            tasks={tasks}
            notScheduled={notScheduled}
            scheduleOf={scheduleOf}
            currentUserId={currentUserId}
            onChangeTime={(taskId) => {
              setPanel({ kind: 'form', taskId });
            }}
            onClose={close}
          />
        )}
        <DayNavigation view={view} days={days} onShow={setShownDay} />
        <Timetable
          days={days}
          scheduled={scheduled}
          dragged={drag.dragged}
          target={drag.target}
          scrollerRef={drag.scrollerRef}
          columnRef={drag.columnRef}
          onOpen={(taskId, control) => {
            open({ kind: 'details', taskId }, control);
          }}
          onPickSlot={(slot, control) => {
            open({ kind: 'slot', ...slot }, control);
          }}
        />
        {setSchedule.isError && (
          <p role="alert" className="text-danger-700 text-sm">
            {t.schedule.moveFailed}
          </p>
        )}
        <p aria-live="polite" className="sr-only">
          {drag.announcement}
        </p>
        <DragOverlay dropAnimation={null}>
          {drag.dragged && <DragPreview title={drag.dragged.task.title} target={drag.target} />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

interface OpenPanelProps {
  panel: Panel;
  view: View;
  days: string[];
  tasks: Task[];
  notScheduled: Task[];
  scheduleOf: Map<string, TaskSchedule>;
  currentUserId: string;
  onChangeTime: (taskId: string) => void;
  onClose: () => void;
}

/**
 * A task's details or form, or what to do at the time tapped; nothing once the task has gone, e.g. done from
 * its details.
 */
function OpenPanel({ panel, days, scheduleOf, tasks, ...props }: OpenPanelProps) {
  if (panel.kind === 'slot') {
    return (
      <SlotPicker
        slot={panel}
        view={props.view}
        tasks={props.notScheduled}
        currentUserId={props.currentUserId}
        onClose={props.onClose}
      />
    );
  }
  const task = tasks.find((candidate) => candidate.id === panel.taskId);
  if (!task) return null;
  const schedule = scheduleOf.get(task.id);
  if (panel.kind === 'details' && schedule) {
    return (
      <ScheduledTaskDetails
        task={task}
        schedule={schedule}
        currentUserId={props.currentUserId}
        onChangeTime={() => {
          props.onChangeTime(task.id);
        }}
        onClose={props.onClose}
      />
    );
  }
  return (
    <ScheduleForm
      key={task.id}
      task={task}
      currentUserId={props.currentUserId}
      initial={
        schedule ?? {
          startsAt: suggestedStart(firstDayToPlan(days), new Date()).toISOString(),
          durationMinutes: DEFAULT_DURATION_MINUTES,
        }
      }
      isScheduled={schedule !== undefined}
      onClose={props.onClose}
    />
  );
}

interface ScheduledTaskDetailsProps {
  task: Task;
  schedule: TaskSchedule;
  currentUserId: string;
  onChangeTime: () => void;
  onClose: () => void;
}

/** A task tapped in the timetable: its card, as on the list, with when it is planned and a way to change it. */
function ScheduledTaskDetails({
  task,
  schedule,
  currentUserId,
  onChangeTime,
  onClose,
}: ScheduledTaskDetailsProps) {
  const { common, schedule: t } = useMessages();
  const startsAt = new Date(schedule.startsAt);
  return (
    <TaskCard key={task.id} as="section" task={task} currentUserId={currentUserId} titleLevel={3}>
      <div className="border-line flex flex-wrap items-center justify-end gap-2 border-t pt-3 text-sm">
        <span className="text-ink mr-auto font-medium">
          {t.when(common.shortDate(startsAt), common.time(startsAt), common.time(endOf(schedule)))}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="border-line-strong bg-surface text-ink hover:bg-page rounded-xl border px-3 py-1.5 font-semibold"
        >
          {t.close}
        </button>
        <button
          type="button"
          aria-label={t.changeTimeLabel(task.title)}
          onClick={onChangeTime}
          className="border-brand-600 text-brand-900 hover:bg-brand-50 rounded-xl border px-3 py-1.5 font-semibold"
        >
          {t.changeTime}
        </button>
      </div>
    </TaskCard>
  );
}

/** The dragged task under the pointer, with the time it would start at. */
function DragPreview({ title, target }: { title: string; target: DropTarget | null }) {
  const t = useMessages();
  return (
    <div className="bg-brand-50 border-brand-600 text-brand-900 w-36 rounded-md border-l-4 px-2 py-1 text-xs font-semibold shadow-lg">
      <span className="block truncate">{title}</span>
      {target && (
        <span className="block font-normal">
          {t.common.time(atMinutes(target.day, target.minutes))}
        </span>
      )}
    </div>
  );
}
