import { DEFAULT_POINTS, NEW_TASK_DEFAULTS, type NewTask } from '@/features/tasks/task';

/**
 * A task's points as the field shows them. A shared task waiting for points starts empty, so an adult
 * editing it chooses them rather than awarding the default by accident.
 */
function pointsValue(task: NewTask): string {
  if (task.points !== null) return String(task.points);
  return task.isPrivate ? String(DEFAULT_POINTS) : '';
}

/** The form's field values (strings, as inputs hold them) for a task, or for a new one. */
export function fieldValues(
  task: NewTask = { title: '', description: null, dueOn: null, ...NEW_TASK_DEFAULTS },
) {
  return {
    title: task.title,
    description: task.description ?? '',
    type: task.type,
    points: pointsValue(task),
    repeat: task.repeatEveryDays === null ? '' : String(task.repeatEveryDays),
    dueOn: task.dueOn ?? '',
    isPrivate: task.isPrivate,
    forChildren: task.forChildren,
    icon: task.icon,
    assignedTo: task.assignedTo,
  };
}

type FieldValues = ReturnType<typeof fieldValues>;

/** The task the field values describe, for `newTaskSchema` to check. */
export function taskInput(values: FieldValues, isChild: boolean) {
  return {
    title: values.title,
    type: values.type,
    // A private task earns nothing; a child's shared task waits for an adult to award its points.
    points: values.isPrivate || isChild ? null : values.points,
    repeatEveryDays: values.repeat === '' ? null : Number(values.repeat),
    dueOn: values.dueOn === '' ? null : values.dueOn,
    description: values.description.trim() === '' ? null : values.description,
    icon: values.icon,
    ...audience(values, isChild),
  };
}

/** Who the task is for, as the field values say. */
function audience(values: FieldValues, isChild: boolean) {
  // An adult's private task is theirs alone, so it isn't for children either.
  const sharedWithChildren = !isChild && !values.isPrivate && values.forChildren;
  return {
    isPrivate: values.isPrivate,
    forChildren: isChild || sharedWithChildren,
    // Only adults give a task for children to one child; a child's edit keeps it (`update_task()`).
    assignedTo: sharedWithChildren ? values.assignedTo : null,
  };
}
