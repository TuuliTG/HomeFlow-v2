/**
 * Planning when to do the tasks that are the user's to do, in a timetable of days and times (ADR 0004). A
 * scheduled block starts at an instant (ISO timestamp), shown in the user's own time zone.
 */
import { z } from 'zod';

import { addDays, fromIsoDate, toIsoDate } from '@/lib/dates';

/** When the user plans to do a task (`task_schedules`). */
export interface TaskSchedule {
  taskId: string;
  /** ISO timestamp. */
  startsAt: string;
  durationMinutes: number;
}

/** Lengths offered for a block, and what a newly scheduled task gets; `set_task_schedule()` allows 5 minutes to 12 hours. */
export const durationChoices = [15, 30, 45, 60, 90, 120, 180, 240] as const;
export const DEFAULT_DURATION_MINUTES = 30;

/**
 * How many days from today a task can be scheduled. `set_task_schedule()` allows a year from now, so any
 * time on the last day offered is within it.
 */
export const MAX_SCHEDULE_DAYS_AWAY = 364;

/** Dragging a block moves it in steps of this many minutes. */
const SNAP_MINUTES = 15;

export const MINUTES_PER_DAY = 24 * 60;

/** The days a timetable shows: one, or a week from Monday. */
const scheduleViews = ['day', 'week'] as const;
export type ScheduleView = (typeof scheduleViews)[number];

/** How the Me page shows the tasks to do: as a list, or in a timetable. Kept in the address as `?view=`. */
export const toDoViews = ['list', ...scheduleViews] as const;
export type ToDoView = (typeof toDoViews)[number];

export function parseToDoView(value: string | null): ToDoView {
  return toDoViews.find((view) => view === value) ?? 'list';
}

/** The Monday of the week `isoDate` is in. */
export function startOfWeek(isoDate: string): string {
  const daysSinceMonday = (fromIsoDate(isoDate).getDay() + 6) % 7;
  return addDays(isoDate, -daysSinceMonday);
}

/** The dates the timetable shows around `isoDate`: that day, or its week from Monday to Sunday. */
export function daysShown(view: ScheduleView, isoDate: string): string[] {
  if (view === 'day') return [isoDate];
  const monday = startOfWeek(isoDate);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

/** Minutes since local midnight. */
export function minutesIntoDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** The instant `minutes` after local midnight at the start of `isoDate`. */
export function atMinutes(isoDate: string, minutes: number): Date {
  const date = fromIsoDate(isoDate);
  date.setHours(0, minutes, 0, 0);
  return date;
}

/** The end of a block (exclusive). */
export function endOf(schedule: Pick<TaskSchedule, 'startsAt' | 'durationMinutes'>): Date {
  return new Date(new Date(schedule.startsAt).getTime() + schedule.durationMinutes * 60_000);
}

/**
 * Where a block dropped `minutes` into a day starts: rounded to the nearest step, and early enough for the
 * whole block to fit in the day.
 */
export function snapStart(minutes: number, durationMinutes: number): number {
  const snapped = Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
  const latest = Math.max(0, MINUTES_PER_DAY - durationMinutes);
  return Math.min(Math.max(snapped, 0), latest - (latest % SNAP_MINUTES));
}

/** A block in one day's column: where it starts and ends in minutes into the day, and its lane. */
export interface PlacedBlock<T> {
  item: T;
  top: number;
  bottom: number;
  /** Side by side with the blocks it overlaps: its lane, counted from the left, out of `lanes`. */
  lane: number;
  lanes: number;
}

/**
 * The blocks shown on `isoDate`, earliest first: those starting that day, cut off at midnight. Overlapping
 * blocks share the column's width in lanes, so none hides another.
 */
export function placeBlocks<T extends Pick<TaskSchedule, 'startsAt' | 'durationMinutes'>>(
  items: T[],
  isoDate: string,
): PlacedBlock<T>[] {
  const placed = items
    .filter((item) => toIsoDate(new Date(item.startsAt)) === isoDate)
    .map((item) => {
      const top = minutesIntoDay(new Date(item.startsAt));
      return { item, top, bottom: Math.min(top + item.durationMinutes, MINUTES_PER_DAY) };
    })
    .sort((a, b) => a.top - b.top || b.bottom - a.bottom);

  const result: PlacedBlock<T>[] = [];
  // Blocks that overlap one another, directly or through others, and the end of each lane among them.
  let cluster: PlacedBlock<T>[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;
  for (const block of placed) {
    if (block.top >= clusterEnd) {
      cluster = [];
      laneEnds = [];
    }
    const free = laneEnds.findIndex((end) => end <= block.top);
    const lane = free === -1 ? laneEnds.length : free;
    laneEnds[lane] = block.bottom;
    clusterEnd = Math.max(clusterEnd, block.bottom);
    const positioned = { ...block, lane, lanes: 0 };
    cluster.push(positioned);
    result.push(positioned);
    for (const member of cluster) member.lanes = laneEnds.length;
  }
  return result;
}

/**
 * Where a new block goes by default: the next full hour when planning today, else 9:00, on `isoDate`.
 * Today's late evening falls back to the last hour that fits.
 */
export function suggestedStart(isoDate: string, now: Date): Date {
  if (isoDate !== toIsoDate(now)) return atMinutes(isoDate, 9 * 60);
  const nextHour = Math.min((now.getHours() + 1) * 60, MINUTES_PER_DAY - 60);
  return atMinutes(isoDate, nextHour);
}

/**
 * Where a new block goes when the user taps `minutes` into a day: the start of the quarter of an hour
 * tapped, early enough for a block of the default length to fit in the day.
 */
export function tappedStart(minutes: number): number {
  const latest = MINUTES_PER_DAY - DEFAULT_DURATION_MINUTES;
  return Math.min(Math.max(Math.floor(minutes / SNAP_MINUTES) * SNAP_MINUTES, 0), latest);
}

const startsAtSchema = z.iso.datetime({ offset: true });

/**
 * When a task added from the timetable is to start (`paths.newTaskAt`), as an ISO timestamp; null if the
 * link has none or it isn't a time.
 */
export function startFromLink(params: URLSearchParams): string | null {
  const parsed = startsAtSchema.safeParse(params.get('at'));
  return parsed.success ? parsed.data : null;
}
