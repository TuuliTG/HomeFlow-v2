import { addDays, LAST_DAY_SHOWN_ONE_BY_ONE } from '@/features/tasks/dueDate';
import type { Task } from '@/features/tasks/task';

export const taskFilters = ['all', 'today', 'week', 'undated', 'available'] as const;

/** Which tasks the board shows; kept in the address as `?show=<filter>`, except `all`. */
export type TaskFilter = (typeof taskFilters)[number];

export const taskFilterLabels: Record<TaskFilter, string> = {
  all: 'All',
  today: 'Today',
  week: 'This week',
  undated: 'No due date',
  available: 'Available',
};

/** What the board says when the filter leaves nothing to show. */
export const taskFilterEmptyMessages: Record<TaskFilter, string> = {
  all: 'No tasks yet. Create the first one!',
  today: 'Nothing is due today.',
  week: 'Nothing is due this week.',
  undated: 'Every task has a due date.',
  available: 'Every task has been picked up.',
};

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
