import { type NewTask, type Task, titleKey } from '@/features/tasks/task';
import type { Messages } from '@/lib/i18n/i18n';
import { fromIsoDate } from '@/lib/dates';

/**
 * One child's open tasks, as an adult sets them up on the child's page (ADR 0004): the always ones by name, then
 * the others (custom), soonest due first as the board loads them.
 */
export function childTaskList(tasks: Task[], childId: string) {
  const mine = tasks.filter((task) => task.assignedTo === childId);
  return {
    always: mine.filter((task) => task.isAlways).toSorted((a, b) => a.title.localeCompare(b.title)),
    custom: mine.filter((task) => !task.isAlways),
  };
}

/** When a child's task comes up, in a few words: how often an always task, or when a custom one. */
export function scheduleOf(task: Task, t: Messages): string {
  if (task.isAlways) return t.tasks.childTasks.timesADay(task.dailyLimit);
  const repeat =
    task.repeatEveryDays === null ? t.tasks.childTasks.once : t.tasks.repeat(task.repeatEveryDays);
  return task.dueOn === null
    ? repeat
    : `${repeat} · ${t.common.shortDate(fromIsoDate(task.dueOn))}`;
}

/** The details of a task, to add it again (e.g. for another child) without its id and history. */
export function newTaskOf(task: Task): NewTask {
  const {
    title,
    description,
    type,
    points,
    repeatEveryDays,
    dueOn,
    isPrivate,
    forChildren,
    icon,
    assignedTo,
    labels,
    customLabels,
    isRoutine,
    isAlways,
    dailyLimit,
  } = task;
  return {
    title,
    description,
    type,
    points,
    repeatEveryDays,
    dueOn,
    isPrivate,
    forChildren,
    icon,
    assignedTo,
    labels,
    customLabels,
    isRoutine,
    isAlways,
    dailyLimit,
  };
}

/**
 * The child's tasks to copy to another child: those the other child doesn't have under the same name yet, so
 * copying twice adds nothing twice.
 */
export function tasksToCopy(tasks: Task[], fromChildId: string, toChildId: string): Task[] {
  const theirs = new Set(
    tasks.filter((task) => task.assignedTo === toChildId).map((task) => titleKey(task.title)),
  );
  return tasks.filter(
    (task) => task.assignedTo === fromChildId && !theirs.has(titleKey(task.title)),
  );
}
