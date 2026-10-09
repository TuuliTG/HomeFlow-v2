/** Reminder times: instants stored as ISO timestamps, entered and shown in the user's own time zone. */
import { formatShortDate } from '@/features/tasks/dueDate';

const pad = (value: number) => String(value).padStart(2, '0');

/** The local "YYYY-MM-DDTHH:mm" a datetime-local input uses. */
export function toDateTimeLocal(date: Date): string {
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The next full hour, as a starting point for a new reminder. */
export function suggestedReminderTime(now: Date): string {
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1, 0, 0, 0);
  return toDateTimeLocal(nextHour);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

/** "Reminder today at 18:00", "Reminder tomorrow at 9:05" or "Reminder Sat 17 Oct at 9:00". */
export function describeReminder(remindAt: string, now: Date): string {
  const date = new Date(remindAt);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const day = isSameDay(date, now)
    ? 'today'
    : isSameDay(date, tomorrow)
      ? 'tomorrow'
      : formatShortDate(date);
  return `Reminder ${day} at ${String(date.getHours())}:${pad(date.getMinutes())}`;
}
