import { z } from 'zod';

import type { TaskReminder } from '@/features/tasks/task';
import { getSupabaseClient } from '@/lib/supabase';

const reminderRowsSchema = z.array(z.object({ task_id: z.string(), remind_at: z.string() }));

/** The user's reminders that haven't been sent yet; Row Level Security hides everyone else's. */
export async function fetchReminders(): Promise<TaskReminder[]> {
  const { data, error } = await getSupabaseClient()
    .from('task_reminders')
    .select('task_id, remind_at');
  if (error) throw error;
  return reminderRowsSchema
    .parse(data)
    .map((row) => ({ taskId: row.task_id, remindAt: row.remind_at }));
}

/**
 * Asks for a push notification about a task at `remindAt` (ISO timestamp), replacing any earlier
 * reminder. Only for an open task that is the user's to do: their private task or one they picked up.
 */
export async function setTaskReminder(taskId: string, remindAt: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('set_task_reminder', {
    task_id: taskId,
    remind_at: remindAt,
  });
  if (error) throw error;
}

/** Removes the user's reminder for a task. */
export async function clearTaskReminder(taskId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('clear_task_reminder', { task_id: taskId });
  if (error) throw error;
}
