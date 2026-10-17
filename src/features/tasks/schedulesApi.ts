import { z } from 'zod';

import type { TaskSchedule } from '@/features/tasks/schedule';
import { getSupabaseClient } from '@/lib/supabase';

const scheduleRowsSchema = z.array(
  z.object({ task_id: z.string(), starts_at: z.string(), duration_minutes: z.number().int() }),
);

/** When the user plans to do their tasks; Row Level Security hides everyone else's schedule. */
export async function fetchSchedules(): Promise<TaskSchedule[]> {
  const { data, error } = await getSupabaseClient()
    .from('task_schedules')
    .select('task_id, starts_at, duration_minutes');
  if (error) throw error;
  return scheduleRowsSchema.parse(data).map((row) => ({
    taskId: row.task_id,
    startsAt: row.starts_at,
    durationMinutes: row.duration_minutes,
  }));
}

/**
 * Plans to do a task from `startsAt` (ISO timestamp) for `durationMinutes`, replacing any earlier plan.
 * Only for an open task that is the user's to do: their private task or one they picked up.
 */
export async function setTaskSchedule({
  taskId,
  startsAt,
  durationMinutes,
}: TaskSchedule): Promise<void> {
  const { error } = await getSupabaseClient().rpc('set_task_schedule', {
    task_id: taskId,
    starts_at: startsAt,
    duration_minutes: durationMinutes,
  });
  if (error) throw error;
}

/** Takes a task off the user's schedule. */
export async function clearTaskSchedule(taskId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('clear_task_schedule', { task_id: taskId });
  if (error) throw error;
}
