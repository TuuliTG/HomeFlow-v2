/** Calendar dates (YYYY-MM-DD) in the user's own time zone. */

/** The local calendar date of `date`. */
function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${String(date.getFullYear())}-${month}-${day}`;
}

/** Local midnight at the start of `isoDate`. */
export function fromIsoDate(isoDate: string): Date {
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
