import type * as tasksApi from '@/features/tasks/api';
import type { NewTask } from '@/features/tasks/task';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';

/**
 * The in-memory tasks behind `fakeTasksApi.ts`, and what tests use to set them up or act as another member.
 */
export interface StoredTask extends NewTask {
  id: string;
  householdId: string;
  createdBy: string;
  pickedUpBy: string | null;
  /** The task this one is the next occurrence of. */
  previousTaskId: string | null;
  /** When it was added (ISO timestamp). */
  createdAt: string;
  /** Who marked it done and when (ISO timestamp); null while open. */
  completed: { by: string; at: string } | null;
}

/** A task as tests describe it: repeating, due date, description and privacy are optional. */
type TaskDetails = Pick<NewTask, 'title' | 'type' | 'points'> & Partial<NewTask>;

/** Oldest first; the api returns them soonest due first, then newest first (`byDueDate`). */
export const tasks: StoredTask[] = [];
let requestsFail = false;
let completions = 0;
export const listeners = new Set<Parameters<typeof tasksApi.subscribeToTaskChanges>[0]>();

function ownHouseholdId(): string | null {
  const user = fakeAuthBackend.currentUser();
  return user ? fakeHouseholdBackend.householdIdOf(user.id) : null;
}

/** Whether the logged-in user can see the task, like the select policy on `tasks`. */
export function isVisible(task: StoredTask): boolean {
  return (
    task.householdId === ownHouseholdId() &&
    (!task.isPrivate || task.createdBy === fakeAuthBackend.currentUser()?.id)
  );
}

/** Delivers a change live to the logged-in user if they can see the task (like Realtime with RLS). */
export function deliver(task: StoredTask, change: tasksApi.TaskChange) {
  if (!isVisible(task)) return;
  listeners.forEach((listener) => {
    listener(change);
  });
}

function store(task: StoredTask, isRepeat: boolean) {
  tasks.push(task);
  deliver(task, {
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

export function openTaskOf(userId: string, taskId: string): StoredTask {
  const task = tasks.find(
    (candidate) =>
      candidate.id === taskId &&
      !candidate.completed &&
      candidate.householdId === fakeHouseholdBackend.householdIdOf(userId) &&
      (!candidate.isPrivate || candidate.createdBy === userId),
  );
  if (!task) throw new Error(`No open task ${taskId} in ${userId}'s household`);
  return task;
}

/** Whether requests fail, like a network error (`fakeTasksBackend.failRequests()`). */
export function requestsFailing(): boolean {
  return requestsFail;
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
        isPrivate: false,
        ...task,
        id: `task:${String(tasks.length)}`,
        householdId,
        createdBy: userId,
        pickedUpBy: null,
        previousTaskId: null,
        createdAt: new Date().toISOString(),
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
    deliver(task, { kind: 'changed' });
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
    deliver(task, { kind: 'changed' });
    if (task.repeatEveryDays === null) return;
    store(
      {
        ...task,
        id: `task:${String(tasks.length)}`,
        dueOn: addDays(completedOn, task.repeatEveryDays),
        pickedUpBy: null,
        previousTaskId: task.id,
        createdAt: new Date().toISOString(),
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
  /** Moves every task, when it was added and done, `ms` into the past, e.g. into an earlier month. */
  ageTasks(ms: number) {
    const earlier = (timestamp: string) =>
      new Date(new Date(timestamp).getTime() - ms).toISOString();
    for (const task of tasks) {
      task.createdAt = earlier(task.createdAt);
      if (task.completed) task.completed.at = earlier(task.completed.at);
    }
  },
  /** Makes every request fail, like a network error. */
  failRequests() {
    requestsFail = true;
  },
};
