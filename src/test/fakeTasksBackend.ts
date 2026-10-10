import type * as tasksApi from '@/features/tasks/api';
import { type NewTask, titleKey } from '@/features/tasks/task';
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
/** Reminders by user id, then task id (ISO timestamps). */
export const reminders = new Map<string, Map<string, string>>();
/** Stars on tasks, like `favourite_tasks`: one per household, name (`titleKey`) and member who starred it. */
const favourites: { householdId: string; key: string; starredBy: string }[] = [];
let requestsFail = false;
let reminderRequestsFail = false;
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

/** Whether the open task is `userId`'s to do, so they can set a reminder for it (`set_task_reminder()`). */
function isToDoBy(task: StoredTask, userId: string): boolean {
  return (task.isPrivate && task.createdBy === userId) || task.pickedUpBy === userId;
}

/**
 * Whether `userId` sees the star (`private.can_see_favourite()`): in their household, and starred by them or on a
 * task they can see, so a star on another member's private task stays hidden.
 */
function canSeeFavourite(userId: string, star: (typeof favourites)[number]): boolean {
  return (
    star.householdId === fakeHouseholdBackend.householdIdOf(userId) &&
    (star.starredBy === userId ||
      tasks.some(
        (task) =>
          task.householdId === star.householdId &&
          titleKey(task.title) === star.key &&
          (!task.isPrivate || task.createdBy === userId),
      ))
  );
}

/** Whether loading reminders fails (`fakeTasksBackend.failReminderRequests()`). */
export function reminderRequestsFailing(): boolean {
  return requestsFail || reminderRequestsFail;
}

/** Whether requests fail, like a network error (`fakeTasksBackend.failRequests()`). */
export function requestsFailing(): boolean {
  return requestsFail;
}

export const fakeTasksBackend = {
  reset() {
    tasks.length = 0;
    reminders.clear();
    favourites.length = 0;
    requestsFail = false;
    reminderRequestsFail = false;
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
  /** How many tasks are stored, so the next one added gets the id `task:<count>`. */
  taskCount: () => tasks.length,
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
  /** Sets `userId`'s reminder for an open task that is theirs to do, like `set_task_reminder()`. */
  setReminderAs(userId: string, taskId: string, remindAt: string) {
    const task = openTaskOf(userId, taskId);
    if (!isToDoBy(task, userId)) throw new Error(`${taskId} is not ${userId}'s to do`);
    if (new Date(remindAt).getTime() < Date.now())
      throw new Error('A reminder must be in the future');
    reminders.set(userId, new Map(reminders.get(userId)).set(taskId, remindAt));
  },
  clearReminderAs(userId: string, taskId: string) {
    reminders.get(userId)?.delete(taskId);
  },
  /** `userId`'s reminder for the task (ISO timestamp), or null. */
  reminderOf(userId: string, taskId: string): string | null {
    return reminders.get(userId)?.get(taskId) ?? null;
  },
  /** Moves every reminder `ms` into the past, e.g. beyond its time. */
  ageReminders(ms: number) {
    for (const byTask of reminders.values()) {
      for (const [taskId, remindAt] of byTask) {
        byTask.set(taskId, new Date(new Date(remindAt).getTime() - ms).toISOString());
      }
    }
  },
  /**
   * Stars or unstars the task with this name for `userId`'s household, like `favourite_tasks`: unstarring
   * removes every star on it they can see.
   */
  setFavouriteAs(userId: string, title: string, isFavourite: boolean) {
    const householdId = fakeHouseholdBackend.householdIdOf(userId);
    if (!householdId) throw new Error(`${userId} is not in a household`);
    const key = titleKey(title);
    const own = (star: (typeof favourites)[number]) =>
      star.key === key && canSeeFavourite(userId, star);
    if (!isFavourite) {
      favourites.splice(0, favourites.length, ...favourites.filter((star) => !own(star)));
    } else if (!favourites.some((star) => own(star) && star.starredBy === userId)) {
      favourites.push({ householdId, key, starredBy: userId });
    }
  },
  /** The names (`titleKey`) of the favourites `userId` can see, each once. */
  favouritesOf(userId: string): string[] {
    return [
      ...new Set(
        favourites.filter((star) => canSeeFavourite(userId, star)).map((star) => star.key),
      ),
    ];
  },
  /** Makes loading reminders fail, while tasks still load. */
  failReminderRequests() {
    reminderRequestsFail = true;
  },
  /** Makes every request fail, like a network error. */
  failRequests() {
    requestsFail = true;
  },
};
