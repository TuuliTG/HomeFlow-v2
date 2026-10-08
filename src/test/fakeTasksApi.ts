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
  isDone: boolean;
}

/** A task as tests describe it: repeating and due date are optional. */
type TaskDetails = Pick<NewTask, 'title' | 'type' | 'points'> & Partial<NewTask>;

/** Oldest first; the api returns them soonest due first, then newest first (`byDueDate`). */
const tasks: StoredTask[] = [];
let requestsFail = false;
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

export const fakeTasksBackend = {
  reset() {
    tasks.length = 0;
    requestsFail = false;
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
        ...task,
        id: `task:${String(tasks.length)}`,
        householdId,
        createdBy: userId,
        isDone: false,
      },
      false,
    );
  },
  /**
   * Marks an open task in `userId`'s household done on `completedOn`, adding the next occurrence of
   * a repeating task like `complete_task()` does, and delivers the changes live.
   */
  completeTaskAs(userId: string, taskId: string, completedOn: string) {
    const task = tasks.find(
      (candidate) =>
        candidate.id === taskId &&
        !candidate.isDone &&
        candidate.householdId === fakeHouseholdBackend.householdIdOf(userId),
    );
    if (!task) throw new Error(`No open task ${taskId} in ${userId}'s household`);
    task.isDone = true;
    deliver(task.householdId, { kind: 'updated' });
    if (task.repeatEveryDays === null) return;
    store(
      {
        ...task,
        id: `task:${String(tasks.length)}`,
        dueOn: addDays(completedOn, task.repeatEveryDays),
        isDone: false,
      },
      true,
    );
  },
  /** Makes loading, adding and completing tasks fail, like a network error. */
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
      .filter((task) => task.householdId === householdId && !task.isDone)
      .reverse()
      .sort(byDueDate)
      .map(({ id, title, type, points, repeatEveryDays, dueOn, createdBy }) => ({
        id,
        title,
        type,
        points,
        repeatEveryDays,
        dueOn,
        createdBy,
        creatorName: fakeAuthBackend.displayNameOf(createdBy),
      })),
  );
};

export const addTask: typeof tasksApi.addTask = (task) => {
  const user = fakeAuthBackend.currentUser();
  if (requestsFail || !user) return Promise.reject(new Error('Network error'));
  fakeTasksBackend.addTaskAs(user.id, task);
  return Promise.resolve();
};

export const completeTask: typeof tasksApi.completeTask = (taskId, completedOn) => {
  const user = fakeAuthBackend.currentUser();
  if (requestsFail || !user) return Promise.reject(new Error('Network error'));
  // Rejects, like the database, if the task is no longer open.
  return Promise.resolve().then(() => {
    fakeTasksBackend.completeTaskAs(user.id, taskId, completedOn);
  });
};

export const subscribeToTaskChanges: typeof tasksApi.subscribeToTaskChanges = (onChange) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};
