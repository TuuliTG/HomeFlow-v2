import { LAST_DAY_SHOWN_ONE_BY_ONE } from '@/features/tasks/dueDate';
import { addDays } from '@/lib/dates';
import type { Task } from '@/features/tasks/task';

export const taskFilters = ['all', 'today', 'week', 'undated', 'available'] as const;

/** Which tasks the board shows; kept in the address as `?show=<filter>`, except `all`. */
export type TaskFilter = (typeof taskFilters)[number];

export function parseTaskFilter(value: string | null): TaskFilter {
  return taskFilters.find((filter) => filter === value) ?? 'all';
}

/** Overdue tasks still need doing, so "Today" and "This week" include them. */
function isDueBy(task: Task, lastDay: string): boolean {
  return task.dueOn !== null && task.dueOn <= lastDay;
}

const matchers: Record<TaskFilter, (task: Task, todayDate: string) => boolean> = {
  all: () => true,
  today: (task, todayDate) => isDueBy(task, todayDate),
  // The same days the board shows one by one, so "This week" ends where "Later" begins.
  week: (task, todayDate) => isDueBy(task, addDays(todayDate, LAST_DAY_SHOWN_ONE_BY_ONE)),
  undated: (task) => task.dueOn === null,
  available: (task) => task.pickedUpBy === null,
};

export function filterTasks(tasks: Task[], filter: TaskFilter, todayDate: string): Task[] {
  return tasks.filter((task) => matchers[filter](task, todayDate));
}

/** Words of a search, lower-cased; none for an empty search. */
function searchWords(query: string): string[] {
  return query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * The tasks whose title or description contains every word of the search, in any order and ignoring case,
 * so "dishes wash" finds "Wash the dishes". Letters like ä stay distinct from a: they are different letters
 * in Finnish.
 */
export function searchTasks(tasks: Task[], query: string): Task[] {
  const words = searchWords(query);
  if (words.length === 0) return tasks;
  return tasks.filter((task) => {
    const text = `${task.title} ${task.description ?? ''}`.toLocaleLowerCase();
    return words.every((word) => text.includes(word));
  });
}
