import type * as tasksApi from '@/features/tasks/api';
import type { NewTask } from '@/features/tasks/task';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';

/**
 * In-memory stand-in for `@/features/tasks/api`, installed for every unit test in `setup.ts`.
 * Like the database, it shows the logged-in user only their own household's open tasks.
 */
interface StoredTask extends NewTask {
  id: string;
  householdId: string;
  createdBy: string;
  pickedUpBy: string | null;
  /** The task this one is the next occurrence of. */
  previousTaskId: string | null;
  /** Who marked it done and when (ISO timestamp); null while open. */
  completed: { by: string; at: string } | null;
}

/** A task as tests describe it: repeating and due date are optional. */
type TaskDetails = Pick<NewTask, 'title' | 'type' | 'points'> & Partial<NewTask>;

/** Oldest first; the api returns them soonest due first, then newest first (`byDueDate`). */
const tasks: StoredTask[] = [];
let requestsFail = false;
let completions = 0;
const listeners = new Set<Parameters<typeof tasksApi.subscribeToTaskChanges>[0]>();

function ownHouseholdId(): string | null {
  const user = fakeAuthBackend.currentUser();
  return user ? fakeHouseholdBackend.householdIdOf(user.id) : null;
}

/** Delivers a change live to the logged-in user if it is in their household (like Realtime with RLS). */
function deliver(householdId: string, change: tasksApi.TaskChange) {
  if (householdId !== ownHouseholdId()) return;
  listeners.forEach((listener) => {
    listener(change);
  });
}

function store(task: StoredTask, isRepeat: boolean) {
  tasks.push(task);
  deliver(task.householdId, {
    kind: 'added',
    id: task.id,
    title: task.title,
    createdBy: task.createdBy,
    isRepeat,
  });
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function openTaskOf(userId: string, taskId: string): StoredTask {
  const task = tasks.find(
    (candidate) =>
      candidate.id === taskId &&
      !candidate.completed &&
      candidate.householdId === fakeHouseholdBackend.householdIdOf(userId),
  );
  if (!task) throw new Error(`No open task ${taskId} in ${userId}'s household`);
  return task;
}

export const fakeTasksBackend = {
  reset() {
    tasks.length = 0;
    requestsFail = false;
    completions = 0;
    listeners.clear();
  },
  /** Stores a task as if `userId` had added it to their household, and delivers it live. */
  addTaskAs(userId: string, task: TaskDetails) {
    const householdId = fakeHouseholdBackend.householdIdOf(userId);
    if (!householdId) throw new Error(`${userId} is not in a household`);
    store(
      {
        repeatEveryDays: null,
        dueOn: null,
        description: null,
        ...task,
        id: `task:${String(tasks.length)}`,
        householdId,
        createdBy: userId,
        pickedUpBy: null,
        previousTaskId: null,
        completed: null,
      },
      false,
    );
  },
  /** Picks up an open task for `userId`, like `pick_up_task()`, and delivers the change live. */
  pickUpTaskAs(userId: string, taskId: string) {
    const task = openTaskOf(userId, taskId);
    if (task.pickedUpBy === userId) return;
    if (task.pickedUpBy) throw new Error('Someone else has picked up this task');
    task.pickedUpBy = userId;
    deliver(task.householdId, { kind: 'changed' });
  },
  /**
   * Marks an open task in `userId`'s household done on `completedOn`, adding the next occurrence of
   * a repeating task like `complete_task()` does, and delivers the changes live.
   */
  completeTaskAs(userId: string, taskId: string, completedOn: string) {
    const task = openTaskOf(userId, taskId);
    completions += 1;
    // A millisecond apart, so the newest completion sorts first.
    task.completed = { by: userId, at: new Date(Date.now() + completions).toISOString() };
    deliver(task.householdId, { kind: 'changed' });
    if (task.repeatEveryDays === null) return;
    store(
      {
        ...task,
        id: `task:${String(tasks.length)}`,
        dueOn: addDays(completedOn, task.repeatEveryDays),
        pickedUpBy: null,
        previousTaskId: task.id,
        completed: null,
      },
      true,
    );
  },
  /** Moves every completion `ms` into the past, e.g. beyond the undo window. */
  ageCompletions(ms: number) {
    for (const task of tasks) {
      if (task.completed) {
        task.completed.at = new Date(new Date(task.completed.at).getTime() - ms).toISOString();
      }
    }
  },
  /** Makes every request fail, like a network error. */
  failRequests() {
    requestsFail = true;
  },
};

/** Like `order by due_on asc nulls last`; a stable sort keeps newest first within a date. */
function byDueDate(a: StoredTask, b: StoredTask): number {
  if (a.dueOn === b.dueOn) return 0;
  if (a.dueOn === null) return 1;
  if (b.dueOn === null) return -1;
  return a.dueOn < b.dueOn ? -1 : 1;
}

export const fetchTasks: typeof tasksApi.fetchTasks = () => {
  if (requestsFail) return Promise.reject(new Error('Network error'));
  const householdId = ownHouseholdId();
  return Promise.resolve(
    tasks
      .filter((task) => task.householdId === householdId && !task.completed)
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
          createdBy,
          creatorName: fakeAuthBackend.displayNameOf(createdBy),
          pickedUpBy,
          pickerName: pickedUpBy ? fakeAuthBackend.displayNameOf(pickedUpBy) : null,
        }),
      ),
  );
};

export const fetchCompletedTasks: typeof tasksApi.fetchCompletedTasks = (userId) => {
  if (requestsFail) return Promise.reject(new Error('Network error'));
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
  if (requestsFail || !user) return Promise.reject(new Error('Network error'));
  fakeTasksBackend.addTaskAs(user.id, task);
  return Promise.resolve();
};

export const completeTask: typeof tasksApi.completeTask = (taskId, completedOn) =>
  asCurrentUser((userId) => {
    fakeTasksBackend.completeTaskAs(userId, taskId, completedOn);
  });

export const fetchHouseholdCompletedTasks: typeof tasksApi.fetchHouseholdCompletedTasks = () => {
  if (requestsFail) return Promise.reject(new Error('Network error'));
  const householdId = ownHouseholdId();
  return Promise.resolve(
    tasks
      .flatMap(({ id, title, type, points, householdId: taskHouseholdId, completed }) =>
        completed && taskHouseholdId === householdId
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
          : [],
      )
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt)),
  );
};

export const fetchTotalPoints: typeof tasksApi.fetchTotalPoints = (userId) => {
  if (requestsFail) return Promise.reject(new Error('Network error'));
  return Promise.resolve(
    tasks.reduce((total, task) => total + (task.completed?.by === userId ? task.points : 0), 0),
  );
};

/** Runs `change` as the logged-in user; rejects, like the database, if it throws. */
function asCurrentUser(change: (userId: string) => void): Promise<void> {
  const user = fakeAuthBackend.currentUser();
  if (requestsFail || !user) return Promise.reject(new Error('Network error'));
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
    deliver(task.householdId, { kind: 'changed' });
  });

export const updateTask: typeof tasksApi.updateTask = (taskId, details) =>
  asCurrentUser((userId) => {
    const task = openTaskOf(userId, taskId);
    Object.assign(task, details);
    deliver(task.householdId, { kind: 'changed' });
  });

export const deleteTask: typeof tasksApi.deleteTask = (taskId) =>
  asCurrentUser((userId) => {
    const task = openTaskOf(userId, taskId);
    tasks.splice(tasks.indexOf(task), 1);
    deliver(task.householdId, { kind: 'changed' });
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
    deliver(task.householdId, { kind: 'changed' });
  });

export const subscribeToTaskChanges: typeof tasksApi.subscribeToTaskChanges = (onChange) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};
