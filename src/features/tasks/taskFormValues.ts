import {
  DEFAULT_POINTS,
  MAX_CHILD_STARS,
  NEW_TASK_DEFAULTS,
  type NewTask,
  newTaskSchema,
  type TaskSuggestion,
} from '@/features/tasks/task';
import { repeatDays, repeatFieldValue } from '@/features/tasks/taskRepeat';
import type { Messages } from '@/lib/i18n/i18n';

/**
 * A task's points as the field shows them. A shared task waiting for points starts empty, so an adult
 * editing it chooses them rather than awarding the default by accident.
 */
function pointsValue(task: NewTask, defaultPoints: number): string {
  if (task.points !== null) return String(task.points);
  return task.isPrivate ? String(defaultPoints) : '';
}

const fieldNames = [
  'title',
  'description',
  'points',
  'repeatEveryDays',
  'dueOn',
  'dailyLimit',
] as const;

/** The form's fields that can be named as the one to fix. */
export type FieldName = (typeof fieldNames)[number];

/** The field a `newTaskSchema` issue's path names; the title when it names none of them. */
export function fieldOf(path: PropertyKey | undefined): FieldName {
  return fieldNames.find((field) => field === path) ?? 'title';
}

/**
 * The form's field values (strings, as inputs hold them) for a task, or for a new one with the user's default
 * points. A private task shows them too, should it be made shared.
 */
export function fieldValues(task?: NewTask, defaultPoints = DEFAULT_POINTS) {
  task ??= {
    title: '',
    description: null,
    dueOn: null,
    ...NEW_TASK_DEFAULTS,
    points: defaultPoints,
  };
  return {
    title: task.title,
    description: task.description ?? '',
    type: task.type,
    points: pointsValue(task, defaultPoints),
    repeat: repeatFieldValue(task.repeatEveryDays),
    dueOn: task.dueOn ?? '',
    isPrivate: task.isPrivate,
    // A private task made shared is an adult's for the adults (a child's are always for children), even one they
    // added while they were a child.
    forChildren: task.forChildren && !task.isPrivate,
    icon: task.icon,
    assignedTo: task.assignedTo,
    labels: task.labels,
    customLabels: task.customLabels,
    isRoutine: task.isRoutine,
    isPriority: task.isPriority,
    isAlways: task.isAlways,
    // An empty value is no limit; a task that isn't an always task yet starts at once a day.
    dailyLimit: dailyLimitValue(task),
  };
}

/** Once a day, what a new always task allows unless the adult chooses otherwise. */
const DEFAULT_DAILY_LIMIT = '1';

/**
 * The daily limit field's value: the times a day, the default once a day while there is none, and whether there
 * is no limit, kept apart so switching "No limit" off brings the number back.
 */
function dailyLimitValue({ isAlways, dailyLimit }: NewTask) {
  return {
    times: dailyLimit === null ? DEFAULT_DAILY_LIMIT : String(dailyLimit),
    noLimit: isAlways && dailyLimit === null,
  };
}

export type FieldValues = ReturnType<typeof fieldValues>;

/**
 * The form with a ready-made task's name and details, keeping who it is for (and which children), and the
 * description, timing or pictures already filled in. A private task keeps having no points.
 */
export function withReadyMadeTask(values: FieldValues, task: TaskSuggestion): FieldValues {
  const { title, type, icon, labels, points } = task;
  return {
    ...values,
    title,
    type,
    icon,
    labels,
    points: points === null ? values.points : String(points),
  };
}

function numberInput(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value);
}

/** A task for children's points are picked as stars, so more points than stars come down to the most stars. */
function pointsInput({ points, forChildren }: FieldValues): number {
  const number = numberInput(points);
  return forChildren ? Math.min(number, MAX_CHILD_STARS) : number;
}

/**
 * Checks the task the field values describe with `newTaskSchema`, or says which field to fix and how. A task
 * for children asks for its stars, which can only be missing, rather than points from 0 to 10.
 */
export function checkTask(values: FieldValues, isChild: boolean, t: Messages) {
  const parsed = newTaskSchema(t).safeParse(taskInput(values, isChild));
  if (parsed.success) return parsed;
  const [issue] = parsed.error.issues;
  const path = issue?.path[0];
  const message =
    values.forChildren && path === 'points' ? t.taskForm.errors.starsRequired : issue?.message;
  return { success: false as const, path, message };
}

/** The task the field values describe, for `newTaskSchema` to check. */
function taskInput(values: FieldValues, isChild: boolean) {
  return {
    title: values.title,
    type: values.type,
    // A private task earns nothing; a child's shared task waits for an adult to award its points. An empty
    // field is no number rather than 0, which would make a task without points.
    points: values.isPrivate || isChild ? null : pointsInput(values),
    ...timingOf(values, isChild),
    description: values.description.trim() === '' ? null : values.description,
    icon: values.icon,
    ...labelsOf(values, isChild),
    // The toggle keeps its value while hidden, so making the task private and shared again brings it back.
    isRoutine: isRoutineTask(values, isChild),
    isPriority: values.isPriority && canBePriority({ ...values, isChild }),
    ...audience(values, isChild),
  };
}

/** What the form says about a task it saves besides the task itself. */
export interface SaveOptions {
  isDone: boolean;
}

interface FormState {
  isChild: boolean;
  isPrivate: boolean;
  forChildren: boolean;
  /** Whether the form offers to add the task as already done. */
  canBeDoneAlready: boolean;
  isAlways: boolean;
  isRoutine: boolean;
}

/**
 * Which fields the form shows, as it changes to suit who the task is for. An adult's task for children
 * (`isForChildren`) shows a choice of child instead, whose own form adds it (ADR 0004). A private task counts for no
 * one, so it has neither a type nor points, and is added to do.
 */
export function shownFields({
  isChild,
  isPrivate,
  forChildren,
  canBeDoneAlready,
  isAlways,
  isRoutine,
}: FormState) {
  const routine = isRoutine && canBeRoutine({ isChild, isPrivate, forChildren });
  /**
   * Whether it is done already, repeats or is due: not for a routine, which is always available, nor when a child
   * edits an always task, which has no repeat or due date they can change.
   */
  const schedule = !routine && !(isAlways && isChild);
  return {
    isForChildren: !isChild && !isPrivate && forChildren,
    type: !isPrivate,
    points: !isPrivate,
    schedule,
    alreadyDone: schedule && canBeDoneAlready && !isPrivate,
  };
}

interface RoutineState {
  isChild: boolean;
  isPrivate: boolean;
  forChildren: boolean;
}

/** Whether the task can be a routine: the board shows routines among the adults' shared tasks. */
export function canBeRoutine({ isChild, isPrivate, forChildren }: RoutineState): boolean {
  return !isChild && !isPrivate && !forChildren;
}

/**
 * Whether the task can be a priority, listed at the top of the board: an adults' shared task that isn't a routine
 * (`tasks_priority_adults_shared`).
 */
export function canBePriority(state: RoutineState & { isRoutine: boolean }): boolean {
  return canBeRoutine(state) && !state.isRoutine;
}

/** Whether the field values make the task a routine; the toggle keeps its value while hidden. */
function isRoutineTask(values: FieldValues, isChild: boolean): boolean {
  return values.isRoutine && canBeRoutine({ ...values, isChild });
}

/**
 * When the task is to be done. Only an adult's task for children can be an always task
 * (`tasks_always_for_children`), which is never due and never repeats, but has a daily limit. A routine is always
 * available, so it is never due and never repeats either (`tasks_routine_always_available`). The fields keep their
 * values while hidden, so turning either off brings them back.
 */
function timingOf(values: FieldValues, isChild: boolean) {
  const isAlways = values.isAlways && isSharedWithChildren(values, isChild);
  if (isRoutineTask(values, isChild)) {
    return { isAlways, repeatEveryDays: null, dueOn: null, dailyLimit: null };
  }
  return isAlways
    ? {
        isAlways,
        repeatEveryDays: null,
        dueOn: null,
        // An emptied field is no number rather than no limit, which only the switch chooses.
        dailyLimit: values.dailyLimit.noLimit ? null : numberInput(values.dailyLimit.times),
      }
    : {
        isAlways,
        repeatEveryDays: repeatDays(values.repeat),
        dueOn: values.dueOn === '' ? null : values.dueOn,
        dailyLimit: null,
      };
}

/** Whether an adult shares the task with the children; their private task is theirs alone. */
function isSharedWithChildren(values: FieldValues, isChild: boolean): boolean {
  return !isChild && !values.isPrivate && values.forChildren;
}

/** The task's labels; an adult's task for children has none, though the field keeps them while hidden. */
function labelsOf(values: FieldValues, isChild: boolean) {
  return isSharedWithChildren(values, isChild)
    ? { labels: [], customLabels: [] }
    : { labels: values.labels, customLabels: values.customLabels };
}

/** Who the task is for, as the field values say. */
function audience(values: FieldValues, isChild: boolean) {
  const sharedWithChildren = isSharedWithChildren(values, isChild);
  return {
    isPrivate: values.isPrivate,
    forChildren: isChild || sharedWithChildren,
    // Only adults give a task for children to one child; a child's edit keeps it (`update_task()`).
    assignedTo: sharedWithChildren ? values.assignedTo : null,
  };
}
