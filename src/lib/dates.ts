/** Calendar dates (YYYY-MM-DD) in the user's own time zone. */

/** The local calendar date of `date`. */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${String(date.getFullYear())}-${month}-${day}`;
}

/** Local midnight at the start of `isoDate`. */
export function fromIsoDate(isoDate: string): Date {
  const [year = 0, month = 1, day = 1] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Today's date where the user is. */
export function today(): string {
  return toIsoDate(new Date());
}

/** Whole days from `from` to `to`, both calendar dates; negative if `to` comes first. */
export function daysBetween(from: string, to: string): number {
  // Rounded, since a day with a daylight saving change is an hour shorter or longer.
  return Math.round((fromIsoDate(to).getTime() - fromIsoDate(from).getTime()) / 86_400_000);
}

export function addDays(isoDate: string, days: number): string {
  const date = fromIsoDate(isoDate);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}
