import type * as pointsApi from '@/features/tasks/pointsApi';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { asCurrentUser } from '@/test/fakeTasksApi';
import { deliver, isVisible, requestsFailing, tasks } from '@/test/fakeTasksBackend';

/**
 * In-memory stand-in for `@/features/tasks/pointsApi`, installed for every unit test in `setup.ts`.
 * The tasks live in `fakeTasksBackend`.
 */

export const fetchTasksWaitingForPoints: typeof pointsApi.fetchTasksWaitingForPoints = () => {
  if (requestsFailing()) return Promise.reject(new Error('Network error'));
  return Promise.resolve(
    tasks
      .filter((task) => isVisible(task) && !task.isPrivate && task.points === null)
      .sort((a, b) => Number(b.completed !== null) - Number(a.completed !== null))
      .map(({ id, title, completed }) => ({
        id,
        title,
        completedBy: completed?.by ?? null,
        completerName: completed ? fakeAuthBackend.displayNameOf(completed.by) : null,
      })),
  );
};

/** Like `award_task_points()`: an adult, a visible shared task without points, 1 to 10. */
export const awardTaskPoints: typeof pointsApi.awardTaskPoints = (taskId, points) =>
  asCurrentUser((userId) => {
    if (fakeHouseholdBackend.isChild(userId)) throw new Error('Only adults award points');
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task || !isVisible(task) || task.isPrivate || task.points !== null) {
      throw new Error('No task waiting for points');
    }
    if (points < 1 || points > 10) throw new Error('Points are from 1 to 10');
    task.points = points;
    deliver(task, { kind: 'changed' });
  });
