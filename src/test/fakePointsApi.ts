import type * as pointsApi from '@/features/tasks/pointsApi';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { asCurrentUser } from '@/test/fakeTasksApi';
import { creditsOf, deliver, isVisible, requestsFailing, tasks } from '@/test/fakeTasksBackend';

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

/** Like `own_total_points()`: the user's credits in their household, also from tasks they can't see. */
export const fetchTotalPoints: typeof pointsApi.fetchTotalPoints = () => {
  const user = fakeAuthBackend.currentUser();
  if (requestsFailing() || !user) return Promise.reject(new Error('Network error'));
  const householdId = fakeHouseholdBackend.householdIdOf(user.id);
  return Promise.resolve(
    tasks
      .filter((task) => task.householdId === householdId)
      .flatMap(creditsOf)
      .filter((credit) => credit.userId === user.id)
      .reduce((total, credit) => total + credit.points, 0),
  );
};
