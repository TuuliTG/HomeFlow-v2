import { z } from 'zod';

import { type NewTask, type Task, taskTypes } from '@/features/tasks/task';
import { fetchDisplayNames } from '@/features/tasks/displayNamesApi';
import { requestRowSchema, taskRequestOf } from '@/features/tasks/requestRow';
import { getSupabaseClient } from '@/lib/supabase';
import { taskIconSchema } from '@/lib/taskIcons';
import { taskLabelsSchema } from '@/lib/taskLabels';

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
    icon: taskIconSchema,
    assigned_to: z.string().nullable(),
    labels: taskLabelsSchema,
    custom_labels: z.array(z.string()),
    task_images: z.array(z.object({ path: z.string(), position: z.number() })),
    /** The occurrence this one repeats; it is done, since completing it added this one. */
    previous: z
      .object({ completed_by: z.string().nullable(), completed_at: z.string().nullable() })
      .nullable(),
    request: requestRowSchema.nullable(),
  }),
);
/**
 * The household's open tasks (not yet done): soonest due first, then those without a due date, each
 * newest first. Row Level Security limits them to the user's household, private tasks to whoever
 * added them, and a child's to tasks for children.
 */
export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await getSupabaseClient()
    .from('tasks')
    .select(
      'id, title, description, type, points, created_by, repeat_every_days, due_on, picked_up_by, is_private, for_children, icon, assigned_to, labels, custom_labels, task_images(path, position), previous:previous_occurrence(completed_by, completed_at), request:task_requests(requested_by, requested_for, answer)',
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
      assigned_to,
      custom_labels,
      task_images,
      previous,
      request,
      ...task
    }) => ({
      ...task,
      assignedTo: assigned_to,
      customLabels: custom_labels,
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

/**
 * Adds a task to the user's household and returns its id; the database fills in the household and the
 * creator.
 */
export async function addTask({
  repeatEveryDays,
  dueOn,
  isPrivate,
  forChildren,
  assignedTo,
  customLabels,
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
      assigned_to: assignedTo,
      custom_labels: customLabels,
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

/** Gives back a task the user picked up, so anyone can pick it up; not one given to them. */
export async function putBackTask(taskId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('put_back_task', { task_id: taskId });
  if (error) throw error;
}

/**
 * Replaces an open task's details. Any member of the household can edit a shared task they see; whether
 * it is private stays as it was when it was added. Only adults can make a task adults-only or give it to a
 * child; a child's edit keeps whose chore it is.
 */
export async function updateTask(
  taskId: string,
  {
    title,
    description,
    type,
    points,
    dueOn,
    repeatEveryDays,
    forChildren,
    icon,
    assignedTo,
    labels,
    customLabels,
  }: NewTask,
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
    task_assigned_to: assignedTo,
    // Says whose chore it is; the database ignores it from a child (`update_task()`).
    task_change_assignee: true,
    task_labels: labels,
    task_custom_labels: customLabels,
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
