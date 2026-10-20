import { z } from 'zod';

import {
  type CompletedTask,
  HOUSEHOLD_COMPLETED_LIMIT,
  type HouseholdCompletedTask,
  type NewTask,
  type Task,
  type TaskHelper,
  taskIconNames,
  taskTypes,
} from '@/features/tasks/task';
import { fetchDisplayNames } from '@/features/tasks/displayNamesApi';
import { requestRowSchema, taskRequestOf } from '@/features/tasks/requestRow';
import { getSupabaseClient } from '@/lib/supabase';

/** A task's icon; one this version of the app doesn't know, e.g. added by a newer one, shows as none. */
const iconSchema = z.enum(taskIconNames).nullable().catch(null);

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
    icon: iconSchema,
    task_images: z.array(z.object({ path: z.string(), position: z.number() })),
    /** The occurrence this one repeats; it is done, since completing it added this one. */
    previous: z
      .object({ completed_by: z.string().nullable(), completed_at: z.string().nullable() })
      .nullable(),
    request: requestRowSchema.nullable(),
  }),
);
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
/**
 * The household's open tasks (not yet done): soonest due first, then those without a due date, each
 * newest first. Row Level Security limits them to the user's household, private tasks to whoever
 * added them, and a child's to tasks for children.
 */
export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await getSupabaseClient()
    .from('tasks')
    .select(
      'id, title, description, type, points, created_by, repeat_every_days, due_on, picked_up_by, is_private, for_children, icon, task_images(path, position), previous:previous_occurrence(completed_by, completed_at), request:task_requests(requested_by, requested_for, answer)',
    )
    .is('completed_at', null)
    .order('due_on', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = taskRowsSchema.parse(data);

  const userIds = rows.flatMap((row) => [
    row.created_by,
    row.picked_up_by,
    row.previous?.completed_by ?? null,
    row.request?.requested_by ?? null,
    row.request?.requested_for ?? null,
  ]);
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
      task_images,
      previous,
      request,
      ...task
    }) => ({
      ...task,
      images: task_images.toSorted((a, b) => a.position - b.position).map((image) => image.path),
      isPrivate: is_private,
      forChildren: for_children,
      repeatEveryDays: repeat_every_days,
      dueOn: due_on,
      createdBy: created_by,
      creatorName: nameOf(created_by),
      pickedUpBy: picked_up_by,
      pickerName: nameOf(picked_up_by),
      // Like statistics, only shared tasks show who did them.
      lastDone:
        is_private || !previous?.completed_at
          ? null
          : {
              by: previous.completed_by,
              name: nameOf(previous.completed_by),
              at: previous.completed_at,
            },
      request: request && taskRequestOf(request, nameOf),
    }),
  );
}

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

/**
 * Adds a task to the user's household and returns its id; the database fills in the household and the
 * creator.
 */
export async function addTask({
  repeatEveryDays,
  dueOn,
  isPrivate,
  forChildren,
  ...task
}: NewTask): Promise<string> {
  const { data, error } = await getSupabaseClient()
    .from('tasks')
    .insert({
      ...task,
      repeat_every_days: repeatEveryDays,
      due_on: dueOn,
      is_private: isPrivate,
      for_children: forChildren,
    })
    .select('id')
    .single();
  if (error) throw error;
  return z.object({ id: z.string() }).parse(data).id;
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
  { title, description, type, points, dueOn, repeatEveryDays, forChildren, icon }: NewTask,
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
    task_icon: icon,
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
