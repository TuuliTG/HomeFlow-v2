import type * as helpersApi from '@/features/tasks/helpersApi';
import { HELPERS_WINDOW_MS } from '@/features/tasks/task';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { asCurrentUser } from '@/test/fakeTasksApi';
import { type Credit, requestsFailing, tasks } from '@/test/fakeTasksBackend';

/**
 * In-memory stand-in for `@/features/tasks/helpersApi`, installed for every unit test in `setup.ts`.
 * Helpers are kept on the tasks in `fakeTasksBackend`.
 */

/** Whether `userId` marked the task done in the last week and it is shared, with points. */
function canChooseHelpersOf(userId: string, taskId: string): boolean {
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (task?.completed?.by !== userId || task.isPrivate || task.points === null) return false;
  return Date.now() - new Date(task.completed.at).getTime() < HELPERS_WINDOW_MS;
}

/** Throws unless the helpers are other members of `userId`'s household, each listed once. */
function checkHelpers(userId: string, helpers: Credit[]) {
  const householdId = fakeHouseholdBackend.householdIdOf(userId);
  const isOtherMember = (helperId: string) =>
    helperId !== userId && fakeHouseholdBackend.householdIdOf(helperId) === householdId;
  if (!helpers.every((helper) => isOtherMember(helper.userId))) {
    throw new Error('Helpers are other members of the household');
  }
  if (new Set(helpers.map((helper) => helper.userId)).size !== helpers.length) {
    throw new Error('Someone is listed twice');
  }
  if (helpers.some((helper) => helper.points < 1)) throw new Error('A share is at least 1');
}

export const fakeHelpersBackend = {
  /**
   * Sets who helped `userId` with a shared task they marked done, like `set_task_helpers()`: other
   * members of their household, each listed once, sharing at most the task's points, within a week.
   */
  setHelpersAs(userId: string, taskId: string, helpers: Credit[]) {
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task || !canChooseHelpersOf(userId, taskId)) {
      throw new Error('You have not marked this task done in the last week');
    }
    checkHelpers(userId, helpers);
    if (helpers.reduce((total, helper) => total + helper.points, 0) > (task.points ?? 0)) {
      throw new Error("Helpers share at most the task's points");
    }
    task.helpers = helpers.map((helper) => ({ ...helper }));
  },
};

export const fetchHouseholdMembers: typeof helpersApi.fetchHouseholdMembers = () => {
  const user = fakeAuthBackend.currentUser();
  if (requestsFailing() || !user) return Promise.reject(new Error('Network error'));
  const householdId = fakeHouseholdBackend.householdIdOf(user.id);
  const ids = householdId ? fakeHouseholdBackend.memberIdsOf(householdId) : [];
  return Promise.resolve(
    ids.map((id) => ({
      id,
      name: fakeAuthBackend.displayNameOf(id),
      isChild: fakeHouseholdBackend.isChild(id),
    })),
  );
};

export const setTaskHelpers: typeof helpersApi.setTaskHelpers = (taskId, helpers) =>
  asCurrentUser((userId) => {
    fakeHelpersBackend.setHelpersAs(userId, taskId, helpers);
  });

export const fetchHelpedTasks: typeof helpersApi.fetchHelpedTasks = () => {
  const user = fakeAuthBackend.currentUser();
  if (requestsFailing() || !user) return Promise.reject(new Error('Network error'));
  const householdId = fakeHouseholdBackend.householdIdOf(user.id);
  return Promise.resolve(
    tasks
      .flatMap((task) => {
        const share = task.helpers.find((helper) => helper.userId === user.id);
        if (!share || !task.completed || task.householdId !== householdId) return [];
        const { id, title, type, completed } = task;
        return [
          {
            id,
            title,
            type,
            points: share.points,
            completedAt: completed.at,
            doerName: fakeAuthBackend.displayNameOf(completed.by),
          },
        ];
      })
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt)),
  );
};
