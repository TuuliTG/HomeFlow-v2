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

function addDays(isoDate: string, days: number): string {
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
