import type { NewTask, TaskType } from '@/features/tasks/task';

const DEFAULT_POINTS = '3';

/** The form's field values (strings, as inputs hold them) for a task, or for a new one. */
export function fieldValues(task: NewTask | undefined) {
  if (!task)
    return {
      title: '',
      description: '',
      type: 'physical' as TaskType,
      points: DEFAULT_POINTS,
      repeat: '',
      dueOn: '',
      isPrivate: false,
      forChildren: false,
    };
  return {
    title: task.title,
    description: task.description ?? '',
    type: task.type,
    points: task.points === null ? DEFAULT_POINTS : String(task.points),
    repeat: task.repeatEveryDays === null ? '' : String(task.repeatEveryDays),
    dueOn: task.dueOn ?? '',
    isPrivate: task.isPrivate,
    forChildren: task.forChildren,
  };
}

type FieldValues = ReturnType<typeof fieldValues>;

/** The task the field values describe, for `newTaskSchema` to check. */
export function taskInput(values: FieldValues, isChild: boolean) {
  return {
    title: values.title,
    type: values.type,
    points: values.isPrivate ? null : values.points,
    repeatEveryDays: values.repeat === '' ? null : Number(values.repeat),
    dueOn: values.dueOn === '' ? null : values.dueOn,
    description: values.description.trim() === '' ? null : values.description,
    isPrivate: values.isPrivate,
    // An adult's private task is theirs alone, so it isn't for children either.
    forChildren: isChild || (!values.isPrivate && values.forChildren),
  };
}
