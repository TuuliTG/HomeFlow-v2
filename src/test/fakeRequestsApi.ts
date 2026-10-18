import type * as requestsApi from '@/features/tasks/requestsApi';
import type { TaskRequest } from '@/features/tasks/task';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { asCurrentUser } from '@/test/fakeTasksApi';
import { deliver, openTaskOf } from '@/test/fakeTasksBackend';

/**
 * In-memory stand-in for `@/features/tasks/requestsApi`, installed for every unit test in `setup.ts`, and
 * what tests use to act as another member.
 */

type StoredRequest = Pick<TaskRequest, 'requestedBy' | 'requestedFor' | 'answer'>;

/** Requests by task id (`task_requests`). */
const requests = new Map<string, StoredRequest>();

export const fakeRequestsBackend = {
  reset() {
    requests.clear();
  },
  /**
   * Asks `memberId` to do an open shared task that is free or `userId`'s, like `request_task()`: another
   * member of the household who may do it, replacing any earlier request.
   */
  requestTaskAs(userId: string, taskId: string, memberId: string) {
    const task = openTaskOf(userId, taskId);
    if (task.isPrivate) throw new Error('A private task cannot be asked of anyone');
    if (task.pickedUpBy !== null && task.pickedUpBy !== userId) {
      throw new Error('Someone else has picked up this task');
    }
    const canDoIt =
      memberId !== userId &&
      fakeHouseholdBackend.householdIdOf(memberId) === task.householdId &&
      (task.forChildren || !fakeHouseholdBackend.isChild(memberId));
    if (!canDoIt) throw new Error('No member with this id in your household can do this task');
    requests.set(taskId, { requestedBy: userId, requestedFor: memberId, answer: null });
    deliver(task, { kind: 'changed' });
  },
  /** Accepts, picking the task up for `userId`, or declines a request waiting for their answer. */
  answerRequestAs(userId: string, taskId: string, accept: boolean) {
    const task = openTaskOf(userId, taskId);
    const request = requests.get(taskId);
    if (request?.requestedFor !== userId || request.answer !== null) {
      throw new Error('No request for this task waits for your answer');
    }
    if (accept) task.pickedUpBy = userId;
    request.answer = accept ? 'accepted' : 'declined';
    deliver(task, { kind: 'changed' });
  },
  cancelRequestAs(userId: string, taskId: string) {
    const task = openTaskOf(userId, taskId);
    const request = requests.get(taskId);
    if (request?.requestedBy !== userId || request.answer === 'accepted') {
      throw new Error('You have no open request for this task');
    }
    requests.delete(taskId);
    deliver(task, { kind: 'changed' });
  },
  /**
   * Like the trigger on tasks when a task changes hands: someone else picking it up settles its request, the
   * member asked picking it up accepts it, and giving back a task one accepted clears it.
   */
  settle(taskId: string, pickedUpBy: string | null) {
    const request = requests.get(taskId);
    if (!request) return;
    if (request.requestedFor === pickedUpBy) request.answer = 'accepted';
    else if (pickedUpBy !== null || request.answer === 'accepted') requests.delete(taskId);
  },
  /** Like the trigger on tasks: a request goes once the task is done. */
  forget(taskId: string) {
    requests.delete(taskId);
  },
  /** The task's request with names, like the embedded `task_requests`. */
  requestOf(taskId: string): TaskRequest | null {
    const request = requests.get(taskId);
    return request
      ? {
          ...request,
          requesterName: fakeAuthBackend.displayNameOf(request.requestedBy),
          askedName: fakeAuthBackend.displayNameOf(request.requestedFor),
        }
      : null;
  },
};

export const requestTask: typeof requestsApi.requestTask = (taskId, memberId) =>
  asCurrentUser((userId) => {
    fakeRequestsBackend.requestTaskAs(userId, taskId, memberId);
  });

export const answerTaskRequest: typeof requestsApi.answerTaskRequest = (taskId, accept) =>
  asCurrentUser((userId) => {
    fakeRequestsBackend.answerRequestAs(userId, taskId, accept);
  });

export const cancelTaskRequest: typeof requestsApi.cancelTaskRequest = (taskId) =>
  asCurrentUser((userId) => {
    fakeRequestsBackend.cancelRequestAs(userId, taskId);
  });
