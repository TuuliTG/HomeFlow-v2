import type * as tasksApi from '@/features/tasks/api';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeRequestsBackend } from '@/test/fakeRequestsApi';
import { fakeSchedulesBackend } from '@/test/fakeSchedulesApi';
import {
  deliver,
  helpersOf,
  fakeTasksBackend,
  openTaskOf,
  isVisible,
  requestsFailing,
  type StoredTask,
  tasks,
} from '@/test/fakeTasksBackend';

/**
 * In-memory stand-in for `@/features/tasks/api`, installed for every unit test in `setup.ts`.
 * Like the database, it shows the logged-in user only their own household's open tasks, private
 * tasks only to whoever added them, and children only tasks for children.
 */

/** Like `order by due_on asc nulls last`; a stable sort keeps newest first within a date. */
function byDueDate(a: StoredTask, b: StoredTask): number {
  if (a.dueOn === b.dueOn) return 0;
  if (a.dueOn === null) return 1;
  if (b.dueOn === null) return -1;
  return a.dueOn < b.dueOn ? -1 : 1;
}

/** Who marked the occurrence before a repeating task done, like the `previous_occurrence` embed. */
function lastDoneOf(previousTaskId: string | null) {
  const completed = tasks.find((task) => task.id === previousTaskId)?.completed;
  if (!completed) return null;
  return { by: completed.by, name: fakeAuthBackend.displayNameOf(completed.by), at: completed.at };
}

export const fetchTasks: typeof tasksApi.fetchTasks = () => {
  if (requestsFailing()) return Promise.reject(new Error('Network error'));
  return Promise.resolve(
    tasks
      .filter((task) => isVisible(task) && !task.completed)
      .reverse()
      .sort(byDueDate)
      .map(
        ({
          id,
          title,
          description,
          type,
          points,
          repeatEveryDays,
          dueOn,
          isPrivate,
          forChildren,
          icon,
          createdBy,
          pickedUpBy,
          previousTaskId,
          images,
        }) => ({
          id,
          title,
          description,
          type,
          points,
          repeatEveryDays,
          dueOn,
          isPrivate,
          forChildren,
          icon,
          createdBy,
          creatorName: fakeAuthBackend.displayNameOf(createdBy),
          pickedUpBy,
          pickerName: pickedUpBy ? fakeAuthBackend.displayNameOf(pickedUpBy) : null,
          images: [...images],
          lastDone: isPrivate ? null : lastDoneOf(previousTaskId),
          request: fakeRequestsBackend.requestOf(id),
        }),
      ),
  );
};

export const fetchCompletedTasks: typeof tasksApi.fetchCompletedTasks = (userId) => {
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

export const addTask: typeof tasksApi.addTask = (task) =>
  asCurrentUser((userId) => {
    // Like the insert policy: a child adds tasks only when allowed, for children and without points.
    if (
      fakeHouseholdBackend.isChild(userId) &&
      (!fakeHouseholdBackend.canAddTasks(userId) || !task.forChildren || task.points !== null)
    ) {
      throw new Error('A child adds tasks only when allowed, without points');
    }
    return fakeTasksBackend.addTaskAs(userId, task);
  });

export const completeTask: typeof tasksApi.completeTask = (taskId, completedOn) =>
  asCurrentUser((userId) => {
    fakeTasksBackend.completeTaskAs(userId, taskId, completedOn);
  });

export const fetchHouseholdCompletedTasks: typeof tasksApi.fetchHouseholdCompletedTasks = () => {
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

/** An open task `userId` may edit or delete, like `private.can_change_task()`: a child's own only. */
export function changeableTaskOf(userId: string, taskId: string): StoredTask {
  const task = openTaskOf(userId, taskId);
  if (fakeHouseholdBackend.isChild(userId) && task.createdBy !== userId) {
    throw new Error('A child changes only tasks they added');
  }
  return task;
}

/** Runs `change` as the logged-in user; rejects, like the database, if it throws. */
export function asCurrentUser<T>(change: (userId: string) => T): Promise<T> {
  const user = fakeAuthBackend.currentUser();
  if (requestsFailing() || !user) return Promise.reject(new Error('Network error'));
  return Promise.resolve().then(() => change(user.id));
}

export const pickUpTask: typeof tasksApi.pickUpTask = (taskId) =>
  asCurrentUser((userId) => {
    fakeTasksBackend.pickUpTaskAs(userId, taskId);
  });

export const putBackTask: typeof tasksApi.putBackTask = (taskId) =>
  asCurrentUser((userId) => {
    const task = openTaskOf(userId, taskId);
    if (task.pickedUpBy !== userId) throw new Error('You have not picked up this task');
    task.pickedUpBy = null;
    fakeRequestsBackend.settle(taskId, null);
    fakeTasksBackend.clearReminderAs(userId, taskId);
    // Like the trigger on tasks: whoever gives a task back no longer plans to do it.
    fakeSchedulesBackend.clearScheduleAs(userId, taskId);
    deliver(task, { kind: 'changed' });
  });

export const updateTask: typeof tasksApi.updateTask = (taskId, details) =>
  asCurrentUser((userId) => {
    const task = changeableTaskOf(userId, taskId);
    const isChild = fakeHouseholdBackend.isChild(userId);
    if (!details.forChildren && isChild) throw new Error('Only adults can make a task adults-only');
    // Like update_task(): a child's edit sends their task back to waiting for points.
    Object.assign(task, { ...details, points: isChild ? null : details.points });
    deliver(task, { kind: 'changed' });
  });

export const deleteTask: typeof tasksApi.deleteTask = (taskId) =>
  asCurrentUser((userId) => {
    const task = changeableTaskOf(userId, taskId);
    tasks.splice(tasks.indexOf(task), 1);
    deliver(task, { kind: 'changed' });
  });

/** Like `undo_complete_task()`, without the time limit (tests run within it). */
export const undoCompleteTask: typeof tasksApi.undoCompleteTask = (taskId) =>
  asCurrentUser((userId) => {
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (task?.completed?.by !== userId) throw new Error('You have not marked this task done');
    const next = tasks.find((candidate) => candidate.previousTaskId === taskId);
    if (next?.completed) throw new Error('The next occurrence is already done');
    if (next) tasks.splice(tasks.indexOf(next), 1);
    task.completed = null;
    task.helpers = [];
    deliver(task, { kind: 'changed' });
  });
