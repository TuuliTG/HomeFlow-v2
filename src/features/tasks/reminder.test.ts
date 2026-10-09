import { describe, expect, it } from 'vitest';

import {
  describeReminder,
  suggestedReminderTime,
  toDateTimeLocal,
} from '@/features/tasks/reminder';

// Thu 9 Oct 2026, 14:20 local time.
const now = new Date(2026, 9, 9, 14, 20);

describe('reminder times', () => {
  it('formats a time for a datetime-local input', () => {
    expect(toDateTimeLocal(new Date(2026, 0, 2, 3, 4))).toBe('2026-01-02T03:04');
  });

  it('suggests the next full hour', () => {
    expect(suggestedReminderTime(now)).toBe('2026-10-09T15:00');
    expect(suggestedReminderTime(new Date(2026, 9, 9, 23, 59))).toBe('2026-10-10T00:00');
  });

  it.each([
    [new Date(2026, 9, 9, 18, 0), 'Reminder today at 18:00'],
    [new Date(2026, 9, 10, 9, 5), 'Reminder tomorrow at 9:05'],
    [new Date(2026, 9, 17, 9, 0), 'Reminder Sat 17 Oct at 9:00'],
  ])('describes %s', (remindAt, description) => {
    expect(describeReminder(remindAt.toISOString(), now)).toBe(description);
  });
});
