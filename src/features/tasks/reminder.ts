/** Reminder times: instants stored as ISO timestamps, entered and shown in the user's own time zone. */
import type { Messages } from '@/lib/i18n/i18n';

const pad = (value: number) => String(value).padStart(2, '0');

/** The local "YYYY-MM-DDTHH:mm" a datetime-local input uses. */
export function toDateTimeLocal(date: Date): string {
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** How far ahead a reminder can be; `set_task_reminder()` enforces it. */
export const MAX_REMINDER_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;

/** How long before the time a task is scheduled for a new reminder suggests going off. */
const REMIND_BEFORE_SCHEDULE_MS = 30 * 60 * 1000;

/**
 * A starting point for a new reminder: half an hour before the time the task is scheduled for (ISO
 * timestamp), if that is still ahead, else the next full hour.
 */
export function suggestedReminderTime(now: Date, scheduledAt?: string): string {
  if (scheduledAt !== undefined) {
    const beforeSchedule = new Date(new Date(scheduledAt).getTime() - REMIND_BEFORE_SCHEDULE_MS);
    if (beforeSchedule > now) return toDateTimeLocal(beforeSchedule);
  }
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1, 0, 0, 0);
  return toDateTimeLocal(nextHour);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

/** "Reminder today at 18:00", "Reminder tomorrow at 9:05" or "Reminder Sat 17 Oct at 9:00". */
export function describeReminder(remindAt: string, now: Date, t: Messages): string {
  const date = new Date(remindAt);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const day = isSameDay(date, now)
    ? t.taskForm.reminder.today
    : isSameDay(date, tomorrow)
      ? t.taskForm.reminder.tomorrow
      : t.common.shortDate(date);
  return t.taskForm.reminder.at(day, t.common.time(date));
}
