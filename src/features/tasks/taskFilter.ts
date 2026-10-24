import { LAST_DAY_SHOWN_ONE_BY_ONE } from '@/features/tasks/dueDate';
import { addDays } from '@/lib/dates';
import type { Task } from '@/features/tasks/task';

export const dueFilters = ['all', 'today', 'week', 'undated'] as const;

/** Which due dates the board shows; kept in the address as `?show=<filter>`, except `all`. */
export type DueFilter = (typeof dueFilters)[number];

/**
 * Which tasks the board shows: a due-date filter, and optionally only the tasks nobody has picked up. Both
 * apply together, e.g. what is due today and still available.
 */
export interface TaskFilter {
  due: DueFilter;
  availableOnly: boolean;
}

export function parseDueFilter(value: string | null): DueFilter {
  return dueFilters.find((filter) => filter === value) ?? 'all';
}

/** Overdue tasks still need doing, so "Today" and "This week" include them. */
function isDueBy(task: Task, lastDay: string): boolean {
  return task.dueOn !== null && task.dueOn <= lastDay;
}

const dueMatchers: Record<DueFilter, (task: Task, todayDate: string) => boolean> = {
  all: () => true,
  today: (task, todayDate) => isDueBy(task, todayDate),
  // The same days the board shows one by one, so "This week" ends where "Later" begins.
  week: (task, todayDate) => isDueBy(task, addDays(todayDate, LAST_DAY_SHOWN_ONE_BY_ONE)),
  undated: (task) => task.dueOn === null,
};

export function filterTasks(tasks: Task[], filter: TaskFilter, todayDate: string): Task[] {
  return tasks.filter(
    (task) =>
      dueMatchers[filter.due](task, todayDate) &&
      (!filter.availableOnly || task.pickedUpBy === null),
  );
}

/**
 * Text ready to compare: lower-cased, and with ä as one character however the device typed it (it can also be
 * a followed by a combining mark).
 */
function comparable(text: string): string {
  return text.normalize('NFC').toLocaleLowerCase();
}

/** Words of a search; none for an empty search. */
function searchWords(query: string): string[] {
  return comparable(query).split(/\s+/).filter(Boolean);
}

/**
 * The tasks whose title or description contains every word of the search, in any order and ignoring case,
 * so "dishes wash" finds "Wash the dishes". Letters like ä stay distinct from a: they are different letters
 * in Finnish and Swedish.
 */
export function searchTasks(tasks: Task[], query: string): Task[] {
  const words = searchWords(query);
  if (words.length === 0) return tasks;
  return tasks.filter((task) => {
    const text = comparable(`${task.title} ${task.description ?? ''}`);
    return words.every((word) => text.includes(word));
  });
}
