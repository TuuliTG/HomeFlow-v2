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

const fieldNames = ['title', 'description', 'points', 'repeatEveryDays', 'dueOn'] as const;

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
    forChildren: task.forChildren,
    icon: task.icon,
    assignedTo: task.assignedTo,
    labels: task.labels,
    customLabels: task.customLabels,
    isRoutine: task.isRoutine,
    isAlways: task.isAlways,
    // An empty value is no limit; a task that isn't an always task yet starts at once a day.
    dailyLimit: dailyLimitValue(task),
  };
}

/** Once a day, what a new always task allows unless the adult chooses otherwise. */
const DEFAULT_DAILY_LIMIT = '1';

/** The "Times a day" field's value: the task's limit, empty for none, or the default if it isn't an always task. */
function dailyLimitValue({ isAlways, dailyLimit }: NewTask): string {
  if (!isAlways) return DEFAULT_DAILY_LIMIT;
  return dailyLimit === null ? '' : String(dailyLimit);
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

/** A task for children's points are picked as stars, so more points than stars come down to the most stars. */
function pointsInput({ points, forChildren }: FieldValues): number {
  if (points.trim() === '') return Number.NaN;
  return forChildren ? Math.min(Number(points), MAX_CHILD_STARS) : Number(points);
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
    // The switch keeps its value while hidden, so turning repeating off and on again brings it back.
    isRoutine: values.isRoutine && canBeRoutine({ ...values, isChild }),
    ...audience(values, isChild),
  };
}

/** What the form says about a task it saves besides the task itself. */
export interface SaveOptions {
  isDone: boolean;
  /**
   * Further children to add the same task for, one copy each, when an adult adds a task for several
   * children; the task itself is the first child's.
   */
  alsoFor: string[];
}

interface FormState {
  isChild: boolean;
  isPrivate: boolean;
  forChildren: boolean;
  /** Whether the form offers to add the task as already done. */
  canBeDoneAlready: boolean;
  isAlways: boolean;
}

/**
 * Which fields the form shows, as it changes to suit who the task is for. An adult's task for children
 * (`isForChildren`) asks which children and the stars each earns, and has neither a type of work nor labels,
 * nor is it added as done, since adults don't do it. A private task counts for no one, so it has neither a type nor points, and is added to do.
 */
export function shownFields({
  isChild,
  isPrivate,
  forChildren,
  canBeDoneAlready,
  isAlways,
}: FormState) {
  const isForChildren = !isChild && !isPrivate && forChildren;
  return {
    isForChildren,
    /** Whether it is a chore for children, also when a child adds it. */
    childrensChore: isChild || isForChildren,
    type: !isForChildren && !isPrivate,
    labels: !isForChildren,
    points: !isPrivate,
    alreadyDone: canBeDoneAlready && !isForChildren && !isPrivate,
    /**
     * Whether it is an always task, which has no repeat or due date to choose: an adult's task for children, or
     * a child editing one (they can't change it).
     */
    isAlways: isAlways && (isForChildren || isChild),
  };
}

interface RoutineState {
  isChild: boolean;
  isPrivate: boolean;
  forChildren: boolean;
  repeat: FieldValues['repeat'];
}

/**
 * Whether the task can be a routine: the board shows routines among the adults' shared tasks, and only a
 * repeating task can be one (`tasks_routine_repeats`).
 */
export function canBeRoutine({ isChild, isPrivate, forChildren, repeat }: RoutineState): boolean {
  return !isChild && !isPrivate && !forChildren && repeatDays(repeat) !== null;
}

/**
 * When the task is to be done. Only an adult's task for children can be an always task
 * (`tasks_always_for_children`), which is never due and never repeats, but has a daily limit; the fields keep their
 * values while hidden, so turning it off brings them back.
 */
function timingOf(values: FieldValues, isChild: boolean) {
  const isAlways = values.isAlways && isSharedWithChildren(values, isChild);
  return isAlways
    ? {
        isAlways,
        repeatEveryDays: null,
        dueOn: null,
        dailyLimit: values.dailyLimit === '' ? null : Number(values.dailyLimit),
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
