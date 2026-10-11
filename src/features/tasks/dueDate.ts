/** Due dates are calendar dates (YYYY-MM-DD) in the user's own time zone. */

import { addDays, fromIsoDate } from '@/lib/dates';
import type { Messages } from '@/lib/i18n/i18n';

/** "Due today", "Due tomorrow", "Due Fri 17 Oct", or "Was due Mon 6 Oct" once it has passed. */
export function describeDueDate(dueOn: string, todayDate: string, t: Messages): string {
  if (dueOn === todayDate) return t.tasks.due.today;
  if (dueOn === addDays(todayDate, 1)) return t.tasks.due.tomorrow;
  const formatted = t.common.shortDate(fromIsoDate(dueOn));
  return dueOn < todayDate ? t.tasks.due.was(formatted) : t.tasks.due.on(formatted);
}

/** The last day, counted from today, that gets a group of its own; anything after is "Later". */
export const LAST_DAY_SHOWN_ONE_BY_ONE = 6;

function dueGroupLabel(dueOn: string | null, todayDate: string, t: Messages): string {
  if (dueOn === null) return t.tasks.dueGroups.noDueDate;
  if (dueOn < todayDate) return t.tasks.dueGroups.overdue;
  if (dueOn === todayDate) return t.common.today;
  if (dueOn === addDays(todayDate, 1)) return t.common.tomorrow;
  if (dueOn > addDays(todayDate, LAST_DAY_SHOWN_ONE_BY_ONE)) return t.tasks.dueGroups.later;
  return t.common.shortDate(fromIsoDate(dueOn));
}

export interface DueGroup<T> {
  /** "Overdue", "Today", "Tomorrow", one of the next five days ("Fri 9 Oct"), "Later" or "No due date". */
  label: string;
  isOverdue: boolean;
  items: T[];
}

/**
 * Splits items sorted soonest due first (no due date last) into groups by when they are due, like an
 * agenda. Groups with nothing in them are left out.
 */
export function groupByDueDate<T extends { dueOn: string | null }>(
  items: T[],
  todayDate: string,
  t: Messages,
): DueGroup<T>[] {
  const groups: DueGroup<T>[] = [];
  for (const item of items) {
    const label = dueGroupLabel(item.dueOn, todayDate, t);
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(item);
    else
      groups.push({
        label,
        isOverdue: item.dueOn !== null && item.dueOn < todayDate,
        items: [item],
      });
  }
  return groups;
}
