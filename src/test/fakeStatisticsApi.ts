import type * as statisticsApi from '@/features/statistics/api';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { requestsFailing, tasks } from '@/test/fakeTasksBackend';

/**
 * In-memory stand-in for `@/features/statistics/api`, installed for every unit test in `setup.ts`.
 * Counts the tasks in `fakeTasksBackend` like `household_statistics()`: the logged-in user's household
 * only, shared tasks only.
 */
export const fetchContributions: typeof statisticsApi.fetchContributions = (since) => {
  const user = fakeAuthBackend.currentUser();
  if (requestsFailing() || !user) return Promise.reject(new Error('Network error'));
  const householdId = fakeHouseholdBackend.householdIdOf(user.id);
  const shared = tasks.filter((task) => task.householdId === householdId && !task.isPrivate);
  const inPeriod = (timestamp: string) => since === null || new Date(timestamp) >= since;
  const memberIds = householdId ? fakeHouseholdBackend.memberIdsOf(householdId) : [];
  return Promise.resolve(
    memberIds.map((userId) => {
      const done = shared.filter(
        ({ completed }) => completed?.by === userId && inPeriod(completed.at),
      );
      return {
        userId,
        displayName: fakeAuthBackend.displayNameOf(userId),
        done: done.length,
        points: done.reduce((total, task) => total + (task.points ?? 0), 0),
        created: shared.filter(
          ({ createdBy, createdAt }) => createdBy === userId && inPeriod(createdAt),
        ).length,
      };
    }),
  );
};
