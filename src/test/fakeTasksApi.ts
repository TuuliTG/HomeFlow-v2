import type * as tasksApi from '@/features/tasks/api';
import type { NewTask } from '@/features/tasks/task';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';

/**
 * In-memory stand-in for `@/features/tasks/api`, installed for every unit test in `setup.ts`.
 * Like the database, it shows the logged-in user only their own household's tasks.
 */
interface StoredTask extends NewTask {
  id: string;
  householdId: string;
  createdBy: string;
}

/** Oldest first; the api returns them newest first. */
const tasks: StoredTask[] = [];
let requestsFail = false;

function ownHouseholdId(): string | null {
  const user = fakeAuthBackend.currentUser();
  return user ? fakeHouseholdBackend.householdIdOf(user.id) : null;
}

export const fakeTasksBackend = {
  reset() {
    tasks.length = 0;
    requestsFail = false;
  },
  /** Stores a task as if `userId` had added it to their household. */
  addTaskAs(userId: string, task: NewTask) {
    const householdId = fakeHouseholdBackend.householdIdOf(userId);
    if (!householdId) throw new Error(`${userId} is not in a household`);
    tasks.push({ ...task, id: `task:${String(tasks.length)}`, householdId, createdBy: userId });
  },
  /** Makes loading and adding tasks fail, like a network error. */
  failRequests() {
    requestsFail = true;
  },
};

export const fetchTasks: typeof tasksApi.fetchTasks = () => {
  if (requestsFail) return Promise.reject(new Error('Network error'));
  const householdId = ownHouseholdId();
  return Promise.resolve(
    tasks
      .filter((task) => task.householdId === householdId)
      .reverse()
      .map(({ id, title, type, points, createdBy }) => ({
        id,
        title,
        type,
        points,
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
