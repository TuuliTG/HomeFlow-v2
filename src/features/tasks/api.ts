import { z } from 'zod';

import { type NewTask, type Task, taskTypes } from '@/features/tasks/task';
import { getSupabaseClient } from '@/lib/supabase';

const taskRowsSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    type: z.enum(taskTypes),
    points: z.number(),
    created_by: z.string().nullable(),
  }),
);
const profileRowsSchema = z.array(z.object({ id: z.string(), display_name: z.string() }));

async function fetchDisplayNames(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .select('id, display_name')
    .in('id', userIds);
  if (error) throw error;
  return new Map(profileRowsSchema.parse(data).map((row) => [row.id, row.display_name]));
}

/** The household's tasks, newest first. Row Level Security limits them to the user's household. */
export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await getSupabaseClient()
    .from('tasks')
    .select('id, title, type, points, created_by')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = taskRowsSchema.parse(data);

  const creatorIds = [...new Set(rows.flatMap((row) => (row.created_by ? [row.created_by] : [])))];
  const names = await fetchDisplayNames(creatorIds);
  return rows.map(({ created_by, ...task }) => ({
    ...task,
    createdBy: created_by,
    creatorName: created_by ? (names.get(created_by) ?? null) : null,
  }));
}

/** Adds a task to the user's household; the database fills in the household and the creator. */
export async function addTask(task: NewTask): Promise<void> {
  const { error } = await getSupabaseClient().from('tasks').insert(task);
  if (error) throw error;
}
