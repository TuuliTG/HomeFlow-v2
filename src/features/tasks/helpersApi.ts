import { z } from 'zod';

import { fetchDisplayNames } from '@/features/tasks/api';
import { type HelpedTask, taskTypes } from '@/features/tasks/task';
import { getSupabaseClient } from '@/lib/supabase';

/** Someone in the user's household who could have helped with a task. */
export interface HouseholdMember {
  id: string;
  /** Their display name, if they have chosen one. */
  name: string | null;
}

/** A helper's share of a task's points, as chosen by whoever marked it done. */
export interface HelperShare {
  userId: string;
  points: number;
}

const memberRowsSchema = z.array(z.object({ user_id: z.string() }));

/** The members of the user's household in the order they joined, with their names. */
export async function fetchHouseholdMembers(): Promise<HouseholdMember[]> {
  const { data, error } = await getSupabaseClient()
    .from('household_members')
    .select('user_id')
    .order('joined_at');
  if (error) throw error;
  const ids = memberRowsSchema.parse(data).map((row) => row.user_id);
  const names = await fetchDisplayNames(ids);
  return ids.map((id) => ({ id, name: names.get(id) ?? null }));
}

/**
 * Says who helped with a shared task the user marked done in the last week, replacing earlier helpers;
 * their shares come out of the task's points (`set_task_helpers()`).
 */
export async function setTaskHelpers(taskId: string, helpers: HelperShare[]): Promise<void> {
  const { error } = await getSupabaseClient().rpc('set_task_helpers', {
    task_id: taskId,
    helpers: helpers.map(({ userId, points }) => ({ user_id: userId, points })),
  });
  if (error) throw error;
}

/** How many of the tasks the user helped with their Me page shows, like the tasks they did. */
const HELPED_TASKS_LIMIT = 20;

const helpedRowsSchema = z.array(
  z.object({
    task_id: z.string(),
    title: z.string(),
    type: z.enum(taskTypes),
    points: z.number(),
    completed_at: z.string(),
    completed_by: z.string().nullable(),
  }),
);

/**
 * The tasks the user most recently helped someone else with, newest first, with their share of the
 * points (`own_helped_tasks()`). A child sees here the adults-only tasks they helped with, and nowhere else.
 */
export async function fetchHelpedTasks(): Promise<HelpedTask[]> {
  const result = await getSupabaseClient().rpc('own_helped_tasks', {
    max_tasks: HELPED_TASKS_LIMIT,
  });
  if (result.error) throw result.error;
  const rows = helpedRowsSchema.parse(result.data);
  const names = await fetchDisplayNames([
    ...new Set(rows.flatMap((row) => (row.completed_by ? [row.completed_by] : []))),
  ]);
  return rows.map(({ task_id, completed_at, completed_by, ...task }) => ({
    ...task,
    id: task_id,
    completedAt: completed_at,
    doerName: completed_by ? (names.get(completed_by) ?? null) : null,
  }));
}
