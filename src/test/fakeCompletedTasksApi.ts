import type * as completedTasksApi from '@/features/tasks/completedTasksApi';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { helpersOf, isVisible, requestsFailing, tasks } from '@/test/fakeTasksBackend';

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

export const fetchHouseholdCompletedTasks: typeof completedTasksApi.fetchHouseholdCompletedTasks =
  () => {
    if (requestsFailing()) return Promise.reject(new Error('Network error'));
    return Promise.resolve(
      tasks
        .flatMap((task) => {
          const { id, title, type, points, completed } = task;
          return completed && isVisible(task) && !task.isPrivate
            ? [
                {
                  id,
                  title,
                  type,
                  points,
                  completedAt: completed.at,
                  completedBy: completed.by,
                  completerName: fakeAuthBackend.displayNameOf(completed.by),
                  helpers: helpersOf(task),
                },
              ]
            : [];
        })
        .sort((a, b) => b.completedAt.localeCompare(a.completedAt)),
    );
  };
