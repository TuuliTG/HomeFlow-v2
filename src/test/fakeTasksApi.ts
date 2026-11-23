import type * as tasksApi from '@/features/tasks/api';
import { canDoTask, type NewTask } from '@/features/tasks/task';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeRequestsBackend } from '@/test/fakeRequestsApi';
import { fakeSchedulesBackend } from '@/test/fakeSchedulesApi';
import {
  deliver,
  fakeTasksBackend,
  openTaskOf,
  isChildIn,
  isVisible,
  requestsFailing,
  type StoredTask,
  tasks,
} from '@/test/fakeTasksBackend';

/**
 * In-memory stand-in for `@/features/tasks/api`, installed for every unit test in `setup.ts`.
 * Like the database, it shows the logged-in user only their own household's open tasks, private
 * tasks only to whoever added them, and children only tasks for children, not other children's chores.
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
          assignedTo,
          labels,
          customLabels,
          isRoutine,
          isAlways,
          dailyLimit,
          isPriority,
          timesDone,
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
          assignedTo,
          labels: [...labels],
          customLabels: [...customLabels],
          isRoutine,
          isAlways,
          dailyLimit,
          isPriority,
          timesDone: { ...timesDone },
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

/** Like `tasks_priority_adults_shared`: only an adults' shared task that is no routine can be a priority. */
function priorityOf(
  task: Pick<NewTask, 'isPriority' | 'isPrivate' | 'forChildren' | 'isRoutine'>,
): boolean {
  return task.isPriority && !task.isPrivate && !task.forChildren && !task.isRoutine;
}

/** Like the insert policy, for each task, and adding all or none. */
export const addTasks: typeof tasksApi.addTasks = (newTasks) =>
  asCurrentUser((userId) => {
    for (const task of newTasks) {
      // A child adds tasks only when allowed, for children and without points.
      if (
        fakeHouseholdBackend.isChild(userId) &&
        (!fakeHouseholdBackend.canAddTasks(userId) || !task.forChildren || task.points !== null)
      ) {
        throw new Error('A child adds tasks only when allowed, without points');
      }
      checkAssignee(userId, task);
      // Only adults add always tasks, and only for children (`tasks_always_for_children`).
      if (task.isAlways && (fakeHouseholdBackend.isChild(userId) || !task.forChildren)) {
        throw new Error('Only adults add always tasks, for children');
      }
      checkGivenToAChild(userId, task);
      if (task.isPriority !== priorityOf(task)) {
        throw new Error("Only the adults' shared tasks can be a priority");
      }
    }
    return newTasks.map((task) => fakeTasksBackend.addTaskAs(userId, ownChore(userId, task)));
  });

export const completeTask: typeof tasksApi.completeTask = (taskId, completedOn) =>
  asCurrentUser((userId) => {
    fakeTasksBackend.completeTaskAs(userId, taskId, completedOn);
  });

/** An open task `userId` may edit or delete, like `private.can_change_task()`: a child's own only. */
export function changeableTaskOf(userId: string, taskId: string): StoredTask {
  const task = openTaskOf(userId, taskId);
  if (fakeHouseholdBackend.isChild(userId) && task.createdBy !== userId) {
    throw new Error('A child changes only tasks they added');
  }
  return task;
}

/**
 * Like the insert policy and `update_task()`: only an adult gives a task, one for children, to a child in their
 * household.
 */
function checkAssignee(userId: string, task: NewTask) {
  if (task.assignedTo === null) return;
  const householdId = fakeHouseholdBackend.householdIdOf(userId);
  if (
    fakeHouseholdBackend.isChild(userId) ||
    householdId === null ||
    !isChildIn(task.assignedTo, householdId) ||
    !task.forChildren ||
    task.isPrivate
  ) {
    throw new Error('Only an adult gives a task for children to a child in their household');
  }
}

/** Like the trigger on tasks: a child's shared task is given to them. */
function ownChore(userId: string, task: NewTask): NewTask {
  const isChildsShared =
    fakeHouseholdBackend.isChild(userId) && task.forChildren && !task.isPrivate;
  return isChildsShared ? { ...task, assignedTo: userId } : task;
}

/** Like `tasks_childrens_given_to_a_child`: an adult's shared task for children is given to a child. */
function checkGivenToAChild(userId: string, task: NewTask) {
  if (fakeHouseholdBackend.isChild(userId) || !task.forChildren || task.isPrivate) return;
  if (task.assignedTo === null) throw new Error('A task for children is given to a child');
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
    if (task.pickedUpBy !== userId || task.assignedTo !== null) {
      throw new Error('You have not picked up this task');
    }
    task.pickedUpBy = null;
    fakeRequestsBackend.settle(taskId, null);
    fakeTasksBackend.clearReminderAs(userId, taskId);
    // Like the trigger on tasks: whoever gives a task back no longer plans to do it.
    fakeSchedulesBackend.clearScheduleAs(userId, taskId);
    deliver(task, { kind: 'changed' });
  });

/**
 * Who has the task picked up after an edit, like the triggers on tasks: a child the task is given to picks it
 * up, and gives it back once it isn't; an adult gives back a task made one for children, and their reminder.
 */
function pickerAfterEdit(task: StoredTask, details: NewTask): string | null {
  const holder = details.assignedTo !== task.assignedTo ? details.assignedTo : task.pickedUpBy;
  if (holder === null || canDoTask({ ...task, ...details }, fakeHouseholdBackend.isChild(holder))) {
    return holder;
  }
  fakeTasksBackend.clearReminderAs(holder, task.id);
  return null;
}

/**
 * Like update_task(): a child's edit keeps whose chore it is, or makes their private task theirs when making it shared,
 * and a task made adults-only is no longer given to a child.
 */
function assigneeAfterEdit(task: StoredTask, details: NewTask, isChild: boolean): string | null {
  if (isChild) return task.assignedTo ?? (isShared(task, details) ? task.createdBy : null);
  return details.forChildren ? details.assignedTo : null;
}

/** Like update_task(): whether the edit makes a private task shared; a shared task can't be made private. */
function isShared(task: StoredTask, details: NewTask): boolean {
  return task.isPrivate && !details.isPrivate;
}

/**
 * Whether the task stays private after the edit. Like update_task(): a child shares a task only while they may add
 * tasks, and an adult's task made shared is no longer theirs to do unless they picked it up, so their reminder and plan
 * go.
 */
function privacyAfterEdit(userId: string, task: StoredTask, details: NewTask) {
  if (!isShared(task, details)) return task.isPrivate;
  const isChild = fakeHouseholdBackend.isChild(userId);
  if (isChild && !fakeHouseholdBackend.canAddTasks(userId)) {
    throw new Error('Only children allowed to add tasks can share one');
  }
  if (!isChild && task.pickedUpBy !== userId) {
    fakeTasksBackend.clearReminderAs(userId, task.id);
    fakeSchedulesBackend.clearScheduleAs(userId, task.id);
  }
  return false;
}

export const updateTask: typeof tasksApi.updateTask = (taskId, details) =>
  asCurrentUser((userId) => {
    const task = changeableTaskOf(userId, taskId);
    const isChild = fakeHouseholdBackend.isChild(userId);
    if (!details.forChildren && isChild) throw new Error('Only adults can make a task adults-only');
    const isPrivate = privacyAfterEdit(userId, task, details);
    const assignedTo = assigneeAfterEdit(task, details, isChild);
    if (!isChild) {
      checkAssignee(userId, { ...details, assignedTo });
      checkGivenToAChild(userId, { ...details, assignedTo });
    }
    const pickedUpBy = pickerAfterEdit(task, { ...details, assignedTo });
    if (pickedUpBy !== task.pickedUpBy) {
      fakeRequestsBackend.settle(taskId, pickedUpBy);
      if (task.pickedUpBy) fakeSchedulesBackend.clearScheduleAs(task.pickedUpBy, taskId);
    }
    Object.assign(task, {
      ...details,
      isPrivate,
      // Like update_task(): a child's edit sends their task back to waiting for points.
      points: isChild ? null : details.points,
      assignedTo,
      pickedUpBy,
      // Like update_task(): a child's edit keeps whether it is an always task.
      isAlways: isChild ? task.isAlways : details.isAlways,
      dailyLimit: isChild ? task.dailyLimit : details.dailyLimit,
      // Like update_task(): only the adults' shared tasks can be a priority.
      isPriority: priorityOf({ ...details, isPrivate }),
    });
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
