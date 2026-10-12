import type * as membershipApi from '@/features/tasks/membershipApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { requestsFailing } from '@/test/fakeTasksBackend';

/**
 * In-memory stand-in for `@/features/tasks/membershipApi`, installed for every unit test in `setup.ts`.
 * Who is a child and who may add tasks live in `fakeHouseholdBackend`.
 */
export const fetchMembership: typeof membershipApi.fetchMembership = (userId) => {
  if (requestsFailing()) return Promise.reject(new Error('Network error'));
  return Promise.resolve({
    householdId: fakeHouseholdBackend.householdIdOf(userId),
    isChild: fakeHouseholdBackend.isChild(userId),
    canAddTasks: fakeHouseholdBackend.canAddTasks(userId),
  });
};
