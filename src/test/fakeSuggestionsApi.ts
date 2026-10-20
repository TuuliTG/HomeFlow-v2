import type * as suggestionsApi from '@/features/tasks/suggestionsApi';
import { isVisible, requestsFailing, type StoredTask, tasks } from '@/test/fakeTasksBackend';

/** In-memory stand-in for `@/features/tasks/suggestionsApi`, installed for every unit test in `setup.ts`. */

/** Like `task_suggestions()`: one per title with its newest details, most often added by members first. */
export const fetchTaskSuggestions: typeof suggestionsApi.fetchTaskSuggestions = () => {
  if (requestsFailing()) return Promise.reject(new Error('Network error'));
  const byTitle = new Map<string, StoredTask[]>();
  for (const task of tasks.filter(isVisible)) {
    const key = task.title.toLowerCase();
    byTitle.set(key, [...(byTitle.get(key) ?? []), task]);
  }
  const suggestions = [...byTitle.values()].map((occurrences) => {
    const added = occurrences.filter((task) => task.previousTaskId === null);
    const newest = occurrences.reduce((a, b) => (b.createdAt >= a.createdAt ? b : a));
    const { title, description, type, points, repeatEveryDays, isPrivate, forChildren } = newest;
    return {
      suggestion: { title, description, type, points, repeatEveryDays, isPrivate, forChildren },
      timesAdded: added.length,
      isOpen: occurrences.some((task) => !task.completed),
      lastAddedAt:
        added
          .map((task) => task.createdAt)
          .sort()
          .at(-1) ?? '',
    };
  });
  return Promise.resolve(
    suggestions
      .sort(
        (a, b) =>
          b.timesAdded - a.timesAdded ||
          b.lastAddedAt.localeCompare(a.lastAddedAt) ||
          a.suggestion.title.localeCompare(b.suggestion.title),
      )
      .map(({ suggestion, timesAdded, isOpen }) => ({ ...suggestion, timesAdded, isOpen })),
  );
};
