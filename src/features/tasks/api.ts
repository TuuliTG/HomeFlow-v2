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
    repeat_every_days: z.number().nullable(),
    due_on: z.string().nullable(),
  }),
);
const newTaskRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  created_by: z.string().nullable(),
  previous_task_id: z.string().nullable(),
});
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

/**
 * The household's open tasks (not yet done): soonest due first, then those without a due date, each
 * newest first. Row Level Security limits them to the user's household.
 */
export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await getSupabaseClient()
    .from('tasks')
    .select('id, title, type, points, created_by, repeat_every_days, due_on')
    .is('completed_at', null)
    .order('due_on', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = taskRowsSchema.parse(data);

  const creatorIds = [...new Set(rows.flatMap((row) => (row.created_by ? [row.created_by] : [])))];
  const names = await fetchDisplayNames(creatorIds);
  return rows.map(({ created_by, repeat_every_days, due_on, ...task }) => ({
    ...task,
    repeatEveryDays: repeat_every_days,
    dueOn: due_on,
    createdBy: created_by,
    creatorName: created_by ? (names.get(created_by) ?? null) : null,
  }));
}

/** Adds a task to the user's household; the database fills in the household and the creator. */
export async function addTask({ repeatEveryDays, dueOn, ...task }: NewTask): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('tasks')
    .insert({ ...task, repeat_every_days: repeatEveryDays, due_on: dueOn });
  if (error) throw error;
}

/**
 * Marks a task done by the user on `completedOn`, their local date. If it repeats, the database adds
 * its next occurrence, due that many days after `completedOn`.
 */
export async function completeTask(taskId: string, completedOn: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('complete_task', {
    task_id: taskId,
    completed_on: completedOn,
  });
  if (error) throw error;
}

/** A change to the household's tasks, as delivered live. */
export type TaskChange =
  | {
      kind: 'added';
      id: string;
      title: string;
      createdBy: string | null;
      /** Added automatically as the next occurrence of a repeating task that was just done. */
      isRepeat: boolean;
    }
  | { kind: 'updated' };

/**
 * Calls `onChange` for each task added to or changed in the household while subscribed (Supabase
 * Realtime, which applies Row Level Security per subscriber). Returns an unsubscribe function.
 */
export function subscribeToTaskChanges(onChange: (change: TaskChange) => void): () => void {
  const client = getSupabaseClient();
  // A unique topic per subscription: a channel that is still leaving would otherwise be reused.
  const channel = client
    .channel(`household-tasks:${crypto.randomUUID()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, (payload) => {
      const row = newTaskRowSchema.safeParse(payload.new);
      if (row.success) {
        onChange({
          kind: 'added',
          id: row.data.id,
          title: row.data.title,
          createdBy: row.data.created_by,
          isRepeat: row.data.previous_task_id !== null,
        });
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, () => {
      onChange({ kind: 'updated' });
    })
    .subscribe((status, error) => {
      if ((['CHANNEL_ERROR', 'TIMED_OUT'] as string[]).includes(status)) {
        console.warn('Live task updates are unavailable', status, error);
      }
    });
  return () => {
    void client.removeChannel(channel);
  };
}
