import { z } from 'zod';

import { fetchDisplayNames } from '@/features/tasks/api';
import { getSupabaseClient } from '@/lib/supabase';

/** A child's shared task whose points an adult hasn't awarded yet (ADR 0004). */
export interface TaskWaitingForPoints {
  id: string;
  title: string;
  /** Whoever marked it done; null while it is open. */
  completedBy: string | null;
  /** Their display name, if they have chosen one. */
  completerName: string | null;
}

const waitingRowsSchema = z.array(
  z.object({ id: z.string(), title: z.string(), completed_by: z.string().nullable() }),
);

/** The household's shared tasks waiting for points, done ones first, newest first. */
export async function fetchTasksWaitingForPoints(): Promise<TaskWaitingForPoints[]> {
  const { data, error } = await getSupabaseClient()
    .from('tasks')
    .select('id, title, completed_by')
    .is('points', null)
    .eq('is_private', false)
    .order('completed_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = waitingRowsSchema.parse(data);
  const names = await fetchDisplayNames([
    ...new Set(rows.flatMap((row) => (row.completed_by ? [row.completed_by] : []))),
  ]);
  return rows.map(({ id, title, completed_by }) => ({
    id,
    title,
    completedBy: completed_by,
    completerName: completed_by ? (names.get(completed_by) ?? null) : null,
  }));
}

/** Awards the points of a task waiting for them; only adults can (`award_task_points()`). */
export async function awardTaskPoints(taskId: string, points: number): Promise<void> {
  const { error } = await getSupabaseClient().rpc('award_task_points', {
    task_id: taskId,
    points,
  });
  if (error) throw error;
}

/**
 * All the points the user has earned in their household (`own_total_points()`): from shared tasks they
 * marked done, less what helpers got, and their shares of tasks they helped with. Private tasks have
 * none, and a child's task waiting for an adult to award its points has none yet.
 */
export async function fetchTotalPoints(): Promise<number> {
  const result = await getSupabaseClient().rpc('own_total_points');
  if (result.error) throw result.error;
  return z.number().parse(result.data);
}
