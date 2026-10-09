import type * as tasksApi from '@/features/tasks/api';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import {
  deliver,
  fakeTasksBackend,
  listeners,
  openTaskOf,
  isVisible,
  requestsFailing,
  type StoredTask,
  tasks,
} from '@/test/fakeTasksBackend';

/**
 * In-memory stand-in for `@/features/tasks/api`, installed for every unit test in `setup.ts`.
 * Like the database, it shows the logged-in user only their own household's open tasks, and private
 * tasks only to whoever added them.
 */

/** Like `order by due_on asc nulls last`; a stable sort keeps newest first within a date. */
function byDueDate(a: StoredTask, b: StoredTask): number {
  if (a.dueOn === b.dueOn) return 0;
  if (a.dueOn === null) return 1;
  if (b.dueOn === null) return -1;
  return a.dueOn < b.dueOn ? -1 : 1;
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
          createdBy,
          pickedUpBy,
        }) => ({
          id,
          title,
          description,
          type,
          points,
          repeatEveryDays,
          dueOn,
          isPrivate,
          createdBy,
          creatorName: fakeAuthBackend.displayNameOf(createdBy),
          pickedUpBy,
          pickerName: pickedUpBy ? fakeAuthBackend.displayNameOf(pickedUpBy) : null,
        }),
      ),
  );
};

export const fetchCompletedTasks: typeof tasksApi.fetchCompletedTasks = (userId) => {
  if (requestsFailing()) return Promise.reject(new Error('Network error'));
  return Promise.resolve(
    tasks
      .flatMap(({ id, title, type, points, completed }) =>
        completed?.by === userId ? [{ id, title, type, points, completedAt: completed.at }] : [],
      )
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt)),
  );
};

export const addTask: typeof tasksApi.addTask = (task) => {
  const user = fakeAuthBackend.currentUser();
  if (requestsFailing() || !user) return Promise.reject(new Error('Network error'));
  fakeTasksBackend.addTaskAs(user.id, task);
  return Promise.resolve();
};

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
        return completed && isVisible(task)
          ? [
              {
                id,
                title,
                type,
                points,
                completedAt: completed.at,
                completedBy: completed.by,
                completerName: fakeAuthBackend.displayNameOf(completed.by),
              },
            ]
          : [];
      })
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt)),
  );
};

export const fetchTotalPoints: typeof tasksApi.fetchTotalPoints = (userId) => {
  if (requestsFailing()) return Promise.reject(new Error('Network error'));
  return Promise.resolve(
    tasks.reduce((total, task) => total + (task.completed?.by === userId ? task.points : 0), 0),
  );
};

/** Runs `change` as the logged-in user; rejects, like the database, if it throws. */
function asCurrentUser(change: (userId: string) => void): Promise<void> {
  const user = fakeAuthBackend.currentUser();
  if (requestsFailing() || !user) return Promise.reject(new Error('Network error'));
  return Promise.resolve().then(() => {
    change(user.id);
  });
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
    deliver(task, { kind: 'changed' });
  });

export const updateTask: typeof tasksApi.updateTask = (taskId, details) =>
  asCurrentUser((userId) => {
    const task = openTaskOf(userId, taskId);
    Object.assign(task, details);
    deliver(task, { kind: 'changed' });
  });

export const deleteTask: typeof tasksApi.deleteTask = (taskId) =>
  asCurrentUser((userId) => {
    const task = openTaskOf(userId, taskId);
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
    deliver(task, { kind: 'changed' });
  });

export const subscribeToTaskChanges: typeof tasksApi.subscribeToTaskChanges = (onChange) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};
