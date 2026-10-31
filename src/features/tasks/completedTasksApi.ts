import { z } from 'zod';

import {
  type CompletedTask,
  HOUSEHOLD_COMPLETED_LIMIT,
  type HouseholdCompletedTask,
  type TaskHelper,
  taskTypes,
} from '@/features/tasks/task';
import { fetchDisplayNames } from '@/features/tasks/displayNamesApi';
import { getSupabaseClient } from '@/lib/supabase';

const helperRowsSchema = z.array(z.object({ user_id: z.string(), points: z.number() }));
const completedTaskRowsSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    type: z.enum(taskTypes),
    points: z.number().nullable(),
    completed_at: z.string(),
    task_helpers: helperRowsSchema,
  }),
);
/** How many of the user's completed tasks the Me screen shows. */
const COMPLETED_TASKS_LIMIT = 20;

type HelperRows = z.infer<typeof helperRowsSchema>;

function helpersOf(rows: HelperRows, names: Map<string, string>): TaskHelper[] {
  return rows.map(({ user_id, points }) => ({
    userId: user_id,
    name: names.get(user_id) ?? null,
    points,
  }));
}

/** The tasks `userId` has marked done most recently, newest first, with who helped. */
export async function fetchCompletedTasks(userId: string): Promise<CompletedTask[]> {
  const { data, error } = await getSupabaseClient()
    .from('tasks')
    .select('id, title, type, points, completed_at, task_helpers(user_id, points)')
    .eq('completed_by', userId)
    .order('completed_at', { ascending: false })
    .limit(COMPLETED_TASKS_LIMIT);
  if (error) throw error;
  const rows = completedTaskRowsSchema.parse(data);
  const names = await fetchDisplayNames([
    ...new Set(rows.flatMap((row) => row.task_helpers.map((helper) => helper.user_id))),
  ]);
  return rows.map(({ completed_at, task_helpers, ...task }) => ({
    ...task,
    completedAt: completed_at,
    helpers: helpersOf(task_helpers, names),
  }));
}

const householdCompletedRowsSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    type: z.enum(taskTypes),
    points: z.number().nullable(),
    completed_at: z.string(),
    completed_by: z.string().nullable(),
    task_helpers: helperRowsSchema,
  }),
);

/** The household's most recently done shared tasks, newest first, with who did them and who helped. */
export async function fetchHouseholdCompletedTasks(): Promise<HouseholdCompletedTask[]> {
  const { data, error } = await getSupabaseClient()
    .from('tasks')
    .select('id, title, type, points, completed_at, completed_by, task_helpers(user_id, points)')
    .not('completed_at', 'is', null)
    .eq('is_private', false)
    .order('completed_at', { ascending: false })
    .limit(HOUSEHOLD_COMPLETED_LIMIT);
  if (error) throw error;
  const rows = householdCompletedRowsSchema.parse(data);
  const peopleIds = rows.flatMap((row) => [
    ...(row.completed_by ? [row.completed_by] : []),
    ...row.task_helpers.map((helper) => helper.user_id),
  ]);
  const names = await fetchDisplayNames([...new Set(peopleIds)]);
  return rows.map(({ completed_at, completed_by, task_helpers, ...task }) => ({
    ...task,
    completedAt: completed_at,
    helpers: helpersOf(task_helpers, names),
    completedBy: completed_by,
    completerName: completed_by ? (names.get(completed_by) ?? null) : null,
  }));
}
