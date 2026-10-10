/** Due dates are calendar dates (YYYY-MM-DD) in the user's own time zone. */

function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${String(date.getFullYear())}-${month}-${day}`;
}

function fromIsoDate(isoDate: string): Date {
  const [year = 0, month = 1, day = 1] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Spelled out rather than Intl-formatted: browsers disagree on the punctuation ("Fri, 17 Oct").
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Today's date where the user is. */
export function today(): string {
  return toIsoDate(new Date());
}

export function addDays(isoDate: string, days: number): string {
  const date = fromIsoDate(isoDate);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** "Thu 8 Oct". */
export function formatShortDate(date: Date): string {
  return `${weekdays[date.getDay()] ?? ''} ${String(date.getDate())} ${months[date.getMonth()] ?? ''}`;
}

/** "Due today", "Due tomorrow", "Due Fri 17 Oct", or "Was due Mon 6 Oct" once it has passed. */
export function describeDueDate(dueOn: string, todayDate: string): string {
  if (dueOn === todayDate) return 'Due today';
  if (dueOn === addDays(todayDate, 1)) return 'Due tomorrow';
  const formatted = formatShortDate(fromIsoDate(dueOn));
  return dueOn < todayDate ? `Was due ${formatted}` : `Due ${formatted}`;
}

/** The last day, counted from today, that gets a group of its own; anything after is "Later". */
export const LAST_DAY_SHOWN_ONE_BY_ONE = 6;

function dueGroupLabel(dueOn: string | null, todayDate: string): string {
  if (dueOn === null) return 'No due date';
  if (dueOn < todayDate) return 'Overdue';
  if (dueOn === todayDate) return 'Today';
  if (dueOn === addDays(todayDate, 1)) return 'Tomorrow';
  if (dueOn > addDays(todayDate, LAST_DAY_SHOWN_ONE_BY_ONE)) return 'Later';
  return formatShortDate(fromIsoDate(dueOn));
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
): DueGroup<T>[] {
  const groups: DueGroup<T>[] = [];
  for (const item of items) {
    const label = dueGroupLabel(item.dueOn, todayDate);
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
