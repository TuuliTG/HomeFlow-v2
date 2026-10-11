import type * as membershipApi from '@/features/tasks/membershipApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { requestsFailing } from '@/test/fakeTasksBackend';

/**
 * In-memory stand-in for `@/features/tasks/membershipApi`, installed for every unit test in `setup.ts`.
 * Who is a child lives in `fakeHouseholdBackend`.
 */
export const fetchIsChild: typeof membershipApi.fetchIsChild = (userId) => {
  if (requestsFailing()) return Promise.reject(new Error('Network error'));
  return Promise.resolve(fakeHouseholdBackend.isChild(userId));
};
