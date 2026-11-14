import type * as completedTasksApi from '@/features/tasks/completedTasksApi';
import { helpersOf, requestsFailing, tasks } from '@/test/fakeTasksBackend';

/** In-memory stand-in for `@/features/tasks/completedTasksApi`, installed for every unit test in `setup.ts`. */

export const fetchCompletedTasks: typeof completedTasksApi.fetchCompletedTasks = (userId) => {
  if (requestsFailing()) return Promise.reject(new Error('Network error'));
  return Promise.resolve(
    tasks
      .flatMap((task) => {
        const { id, title, type, points, completed } = task;
        if (completed?.by !== userId) return [];
        return [{ id, title, type, points, completedAt: completed.at, helpers: helpersOf(task) }];
      })
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt)),
  );
};
