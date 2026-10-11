import type * as liveApi from '@/features/tasks/liveApi';
import { listeners } from '@/test/fakeTasksBackend';

/**
 * In-memory stand-in for `@/features/tasks/liveApi`, installed for every unit test in `setup.ts`.
 * `fakeTasksBackend` delivers changes to the subscribed listeners.
 */
export const subscribeToTaskChanges: typeof liveApi.subscribeToTaskChanges = (onChange) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};
