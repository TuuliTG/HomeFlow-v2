/**
 * What the send-reminders Edge Function does (ADR 0004, ADR 0005), without Deno, Supabase or
 * web-push, so it can be unit-tested with Vitest. index.ts supplies the real dependencies.
 */
import { type PushDependencies, type PushResult, pushToUsers } from '../_shared/push.ts';

/** A reminder that has come due for a task that is still the user's to do. */
export interface DueReminder {
  userId: string;
  taskTitle: string;
}

export interface RemindDependencies extends PushDependencies {
  /** Removes every due reminder from the database and returns those still worth sending. */
  takeDueReminders: () => Promise<DueReminder[]>;
}

/** Sends each due reminder to its user's devices; returns the totals over all of them. */
export async function sendDueReminders(deps: RemindDependencies): Promise<PushResult> {
  const reminders = await deps.takeDueReminders();
  const results = await Promise.all(
    reminders.map(({ userId, taskTitle }) =>
      pushToUsers([userId], { title: 'Reminder', body: taskTitle, url: '/me' }, deps),
    ),
  );
  return results.reduce(
    (total, result) => ({
      sent: total.sent + result.sent,
      removed: total.removed + result.removed,
      failed: total.failed + result.failed,
    }),
    { sent: 0, removed: 0, failed: 0 },
  );
}
