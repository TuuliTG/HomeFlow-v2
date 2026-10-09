import type * as remindersApi from '@/features/tasks/remindersApi';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeTasksBackend, reminders, requestsFailing } from '@/test/fakeTasksBackend';
import { asCurrentUser } from '@/test/fakeTasksApi';

/**
 * In-memory stand-in for `@/features/tasks/remindersApi`, installed for every unit test in
 * `setup.ts`. Reminders live in `fakeTasksBackend` with the tasks they belong to.
 */

export const fetchReminders: typeof remindersApi.fetchReminders = () => {
  const user = fakeAuthBackend.currentUser();
  if (requestsFailing() || !user) return Promise.reject(new Error('Network error'));
  return Promise.resolve(
    [...(reminders.get(user.id) ?? new Map<string, string>())].map(([taskId, remindAt]) => ({
      taskId,
      remindAt,
    })),
  );
};

export const setTaskReminder: typeof remindersApi.setTaskReminder = (taskId, remindAt) =>
  asCurrentUser((userId) => {
    fakeTasksBackend.setReminderAs(userId, taskId, remindAt);
  });

export const clearTaskReminder: typeof remindersApi.clearTaskReminder = (taskId) =>
  asCurrentUser((userId) => {
    fakeTasksBackend.clearReminderAs(userId, taskId);
  });
