import type { TaskSchedule } from '@/features/tasks/schedule';
import type * as schedulesApi from '@/features/tasks/schedulesApi';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { isToDoBy, openTaskOf, requestsFailing } from '@/test/fakeTasksBackend';
import { asCurrentUser } from '@/test/fakeTasksApi';

/**
 * In-memory stand-in for `@/features/tasks/schedulesApi`, installed for every unit test in `setup.ts`, and
 * what tests use to set up schedules.
 */

/** Schedules by user id, then task id (`task_schedules`). */
const schedules = new Map<string, Map<string, TaskSchedule>>();

export const fakeSchedulesBackend = {
  reset() {
    schedules.clear();
  },
  /** Schedules an open task that is `userId`'s to do, like `set_task_schedule()`. */
  scheduleAs(userId: string, schedule: TaskSchedule) {
    const task = openTaskOf(userId, schedule.taskId);
    if (!isToDoBy(task, userId)) throw new Error(`${schedule.taskId} is not ${userId}'s to do`);
    schedules.set(userId, new Map(schedules.get(userId)).set(schedule.taskId, schedule));
  },
  /** Takes a task off `userId`'s schedule, like `clear_task_schedule()` and putting the task back. */
  clearScheduleAs(userId: string, taskId: string) {
    schedules.get(userId)?.delete(taskId);
  },
  /** `userId`'s schedule for the task, or null. */
  scheduleOf(userId: string, taskId: string): TaskSchedule | null {
    return schedules.get(userId)?.get(taskId) ?? null;
  },
};

export const fetchSchedules: typeof schedulesApi.fetchSchedules = () => {
  const user = fakeAuthBackend.currentUser();
  if (requestsFailing() || !user) return Promise.reject(new Error('Network error'));
  return Promise.resolve([...(schedules.get(user.id)?.values() ?? [])]);
};

export const setTaskSchedule: typeof schedulesApi.setTaskSchedule = (schedule) =>
  asCurrentUser((userId) => {
    fakeSchedulesBackend.scheduleAs(userId, schedule);
  });

export const clearTaskSchedule: typeof schedulesApi.clearTaskSchedule = (taskId) =>
  asCurrentUser((userId) => {
    fakeSchedulesBackend.clearScheduleAs(userId, taskId);
  });
