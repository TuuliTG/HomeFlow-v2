import {
  type DndContextProps,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useCallback, useEffect, useRef, useState } from 'react';

import { atMinutes, minutesIntoDay, snapStart } from '@/features/tasks/schedule';
import type { Task } from '@/features/tasks/task';
import { useMessages } from '@/lib/i18n/i18n';

/** Height of a minute in the timetable, in pixels: an hour is 60px. */
export const PX_PER_MINUTE = 1;

/** What is being dragged: a block in the timetable, or a task not scheduled yet. */
export interface DragData {
  task: Task;
  durationMinutes: number;
  /** When a block in the timetable starts (ISO timestamp); undefined for a task not scheduled yet. */
  startsAt?: string;
}

/** Where a dragged block would go: a day shown and its start, in minutes into the day. */
export interface DropTarget {
  day: string;
  minutes: number;
}

interface Point {
  x: number;
  y: number;
}

/** Where the pointer or finger is. */
function pointOf(event: Event): Point | null {
  if (event instanceof MouseEvent) return { x: event.clientX, y: event.clientY };
  if (typeof TouchEvent !== 'undefined' && event instanceof TouchEvent) {
    const touch = event.touches[0] ?? event.changedTouches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  }
  return null;
}

const isInside = (point: Point, rect: DOMRect) =>
  point.x >= rect.left && point.x < rect.right && point.y >= rect.top && point.y < rect.bottom;

const dataOf = (active: DragStartEvent['active']) => active.data.current as DragData;

/** Our own live region says what happens to a dragged task, in the user's language. */
const silent = {
  onDragStart: () => undefined,
  onDragOver: () => undefined,
  onDragEnd: () => undefined,
  onDragCancel: () => undefined,
};

/**
 * Dragging tasks into the timetable and around it, with a mouse or by touching and holding. The day and
 * time come from where the pointer is over the days' columns, measured when it moves, so they stay right
 * while the timetable scrolls.
 */
export function useTimetableDrag(onDrop: (task: Task, startsAt: Date, minutes: number) => void) {
  const [dragged, setDragged] = useState<DragData | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  const [announcement, setAnnouncement] = useState('');
  /** Each day's column by date, and the scrolling box they are in. */
  const columns = useRef(new Map<string, HTMLElement>());
  const scroller = useRef<HTMLElement | null>(null);
  const pointer = useRef<Point | null>(null);
  // How far below the top of the dragged block it was grabbed, so it lands where it is seen.
  const grabOffset = useRef(0);
  // Set while a drag ends, so the click that may follow doesn't open the form.
  const justDragged = useRef(false);
  const t = useMessages();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Touch and hold, so a quick swipe still scrolls the page.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  useEffect(() => {
    if (!dragged) return;
    const follow = (event: Event) => {
      pointer.current = pointOf(event) ?? pointer.current;
    };
    window.addEventListener('mousemove', follow, { passive: true });
    window.addEventListener('touchmove', follow, { passive: true });
    return () => {
      window.removeEventListener('mousemove', follow);
      window.removeEventListener('touchmove', follow);
    };
  }, [dragged]);

  /** The day under the pointer and where its column is now, if the pointer is over the timetable. */
  function columnUnderPointer(): { day: string; rect: DOMRect; point: Point } | null {
    const point = pointer.current;
    const visible = scroller.current?.getBoundingClientRect();
    if (!point || !visible || !isInside(point, visible)) return null;
    for (const [day, column] of columns.current) {
      const rect = column.getBoundingClientRect();
      if (point.x >= rect.left && point.x < rect.right) return { day, rect, point };
    }
    return null;
  }

  /** Where the dragged block would start, if the pointer is over a day in the timetable. */
  function targetUnderPointer(durationMinutes: number): DropTarget | null {
    const column = columnUnderPointer();
    if (!column) return null;
    const minutes = (column.point.y - grabOffset.current - column.rect.top) / PX_PER_MINUTE;
    return { day: column.day, minutes: snapStart(minutes, durationMinutes) };
  }

  function finish(message: string) {
    justDragged.current = true;
    setTimeout(() => {
      justDragged.current = false;
    });
    setDragged(null);
    setTarget(null);
    pointer.current = null;
    setAnnouncement(message);
  }

  const handlers: Pick<
    DndContextProps,
    'onDragStart' | 'onDragMove' | 'onDragEnd' | 'onDragCancel' | 'accessibility'
  > = {
    accessibility: { announcements: silent, screenReaderInstructions: { draggable: '' } },
    onDragStart: ({ active, activatorEvent }: DragStartEvent) => {
      const data = dataOf(active);
      pointer.current = pointOf(activatorEvent);
      // A block keeps the spot it was grabbed at under the pointer; a task not scheduled yet lands with
      // its top there.
      const column = data.startsAt === undefined ? null : columnUnderPointer();
      grabOffset.current =
        column && data.startsAt !== undefined
          ? column.point.y -
            column.rect.top -
            minutesIntoDay(new Date(data.startsAt)) * PX_PER_MINUTE
          : 0;
      setDragged(data);
      setAnnouncement(t.schedule.dragging(data.task.title));
    },
    onDragMove: ({ active }: DragMoveEvent) => {
      const next = targetUnderPointer(dataOf(active).durationMinutes);
      if (next?.day !== target?.day || next?.minutes !== target?.minutes) setTarget(next);
    },
    onDragEnd: ({ active }: DragEndEvent) => {
      const { task, durationMinutes } = dataOf(active);
      const drop = targetUnderPointer(durationMinutes);
      if (!drop) {
        finish(t.schedule.notMoved(task.title));
        return;
      }
      const startsAt = atMinutes(drop.day, drop.minutes);
      onDrop(task, startsAt, durationMinutes);
      finish(t.schedule.dropped(task.title, t.common.shortDate(startsAt), t.common.time(startsAt)));
    },
    onDragCancel: ({ active }) => {
      finish(t.schedule.notMoved(dataOf(active).task.title));
    },
  };

  const scrollerRef = useCallback((element: HTMLElement | null) => {
    scroller.current = element;
  }, []);
  const columnRef = useCallback((day: string, element: HTMLElement | null) => {
    if (element) columns.current.set(day, element);
    else columns.current.delete(day);
  }, []);

  return {
    sensors,
    handlers,
    dragged,
    target,
    announcement,
    /** For the timetable to say where its scrolling box and each day's column are. */
    scrollerRef,
    columnRef,
    /** Whether a drag has just ended, so a click isn't taken as a tap. */
    wasJustDragged: () => justDragged.current,
  };
}
