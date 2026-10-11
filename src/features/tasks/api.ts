import { z } from 'zod';

import {
  type CompletedTask,
  HOUSEHOLD_COMPLETED_LIMIT,
  type HouseholdCompletedTask,
  type NewTask,
  type Task,
  type TaskSuggestion,
  taskTypes,
} from '@/features/tasks/task';
import { getSupabaseClient } from '@/lib/supabase';

const taskRowsSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    type: z.enum(taskTypes),
    points: z.number().nullable(),
    created_by: z.string().nullable(),
    repeat_every_days: z.number().nullable(),
    due_on: z.string().nullable(),
    picked_up_by: z.string().nullable(),
    is_private: z.boolean(),
    for_children: z.boolean(),
  }),
);
const completedTaskRowsSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    type: z.enum(taskTypes),
    points: z.number().nullable(),
    completed_at: z.string(),
  }),
);
/** How many of the user's completed tasks the Me screen shows. */
const COMPLETED_TASKS_LIMIT = 20;
const profileRowsSchema = z.array(z.object({ id: z.string(), display_name: z.string() }));

export async function fetchDisplayNames(userIds: string[]): Promise<Map<string, string>> {
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
 * newest first. Row Level Security limits them to the user's household, private tasks to whoever
 * added them, and a child's to tasks for children.
 */
export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await getSupabaseClient()
    .from('tasks')
    .select(
      'id, title, description, type, points, created_by, repeat_every_days, due_on, picked_up_by, is_private, for_children',
    )
    .is('completed_at', null)
    .order('due_on', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = taskRowsSchema.parse(data);

  const userIds = rows.flatMap((row) => [row.created_by, row.picked_up_by]);
  const names = await fetchDisplayNames([
    ...new Set(userIds.filter((id): id is string => id !== null)),
  ]);
  const nameOf = (userId: string | null) => (userId ? (names.get(userId) ?? null) : null);
  return rows.map(
    ({
      created_by,
      repeat_every_days,
      due_on,
      picked_up_by,
      is_private,
      for_children,
      ...task
    }) => ({
      ...task,
      isPrivate: is_private,
      forChildren: for_children,
      repeatEveryDays: repeat_every_days,
      dueOn: due_on,
      createdBy: created_by,
      creatorName: nameOf(created_by),
      pickedUpBy: picked_up_by,
      pickerName: nameOf(picked_up_by),
    }),
  );
}

/** The tasks `userId` has marked done most recently, newest first. */
export async function fetchCompletedTasks(userId: string): Promise<CompletedTask[]> {
  const { data, error } = await getSupabaseClient()
    .from('tasks')
    .select('id, title, type, points, completed_at')
    .eq('completed_by', userId)
    .order('completed_at', { ascending: false })
    .limit(COMPLETED_TASKS_LIMIT);
  if (error) throw error;
  return completedTaskRowsSchema
    .parse(data)
    .map(({ completed_at, ...task }) => ({ ...task, completedAt: completed_at }));
}

const householdCompletedRowsSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    type: z.enum(taskTypes),
    points: z.number().nullable(),
    completed_at: z.string(),
    completed_by: z.string().nullable(),
  }),
);

/** The household's most recently done shared tasks, newest first, with who did them. */
export async function fetchHouseholdCompletedTasks(): Promise<HouseholdCompletedTask[]> {
  const { data, error } = await getSupabaseClient()
    .from('tasks')
    .select('id, title, type, points, completed_at, completed_by')
    .not('completed_at', 'is', null)
    .eq('is_private', false)
    .order('completed_at', { ascending: false })
    .limit(HOUSEHOLD_COMPLETED_LIMIT);
  if (error) throw error;
  const rows = householdCompletedRowsSchema.parse(data);
  const completerIds = rows.flatMap((row) => (row.completed_by ? [row.completed_by] : []));
  const names = await fetchDisplayNames([...new Set(completerIds)]);
  return rows.map(({ completed_at, completed_by, ...task }) => ({
    ...task,
    completedAt: completed_at,
    completedBy: completed_by,
    completerName: completed_by ? (names.get(completed_by) ?? null) : null,
  }));
}

const pointsRowsSchema = z.array(z.object({ points: z.number().nullable() }));

/**
 * All the points `userId` has earned by marking shared tasks done; private tasks have none, and a child's
 * task waiting for an adult to award its points has none yet.
 */
export async function fetchTotalPoints(userId: string): Promise<number> {
  const { data, error } = await getSupabaseClient()
    .from('tasks')
    .select('points')
    .eq('completed_by', userId)
    .eq('is_private', false);
  if (error) throw error;
  return pointsRowsSchema.parse(data).reduce((total, row) => total + (row.points ?? 0), 0);
}

const suggestionRowsSchema = z.array(
  z.object({
    title: z.string(),
    description: z.string().nullable(),
    type: z.enum(taskTypes),
    points: z.number().nullable(),
    repeat_every_days: z.number().nullable(),
    is_private: z.boolean(),
    for_children: z.boolean(),
    times_added: z.number(),
    is_open: z.boolean(),
  }),
);

/**
 * The tasks the household has added before, one per title with its newest details, most often added
 * first. Other members' private tasks are left out.
 */
export async function fetchTaskSuggestions(): Promise<TaskSuggestion[]> {
  const result = await getSupabaseClient().rpc('task_suggestions');
  if (result.error) throw result.error;
  return suggestionRowsSchema
    .parse(result.data)
    .map(({ repeat_every_days, is_private, for_children, times_added, is_open, ...task }) => ({
      ...task,
      repeatEveryDays: repeat_every_days,
      isPrivate: is_private,
      forChildren: for_children,
      timesAdded: times_added,
      isOpen: is_open,
    }));
}

/** Adds a task to the user's household; the database fills in the household and the creator. */
export async function addTask({
  repeatEveryDays,
  dueOn,
  isPrivate,
  forChildren,
  ...task
}: NewTask): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('tasks')
    .insert({
      ...task,
      repeat_every_days: repeatEveryDays,
      due_on: dueOn,
      is_private: isPrivate,
      for_children: forChildren,
    });
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

/** Takes an open task for the user to do. Fails if someone else has already picked it up. */
export async function pickUpTask(taskId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('pick_up_task', { task_id: taskId });
  if (error) throw error;
}

/** Gives back a task the user picked up, so anyone can pick it up. */
export async function putBackTask(taskId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('put_back_task', { task_id: taskId });
  if (error) throw error;
}

/**
 * Replaces an open task's details. Any member of the household can edit a shared task they see; whether
 * it is private stays as it was when it was added. Only adults can make a task adults-only.
 */
export async function updateTask(
  taskId: string,
  { title, description, type, points, dueOn, repeatEveryDays, forChildren }: NewTask,
): Promise<void> {
  const { error } = await getSupabaseClient().rpc('update_task', {
    task_id: taskId,
    task_title: title,
    task_description: description,
    task_type: type,
    task_points: points,
    task_due_on: dueOn,
    task_repeat_every_days: repeatEveryDays,
    task_for_children: forChildren,
  });
  if (error) throw error;
}

/** Deletes an open task. Any member of the household can delete it. */
export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('delete_task', { task_id: taskId });
  if (error) throw error;
}

/** Reopens a task the user marked done in the last hour, removing the next occurrence it created. */
export async function undoCompleteTask(taskId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('undo_complete_task', { task_id: taskId });
  if (error) throw error;
}
