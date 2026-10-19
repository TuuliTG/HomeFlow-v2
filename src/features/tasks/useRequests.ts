import { useMutation, useQueryClient } from '@tanstack/react-query';

import { answerTaskRequest, cancelTaskRequest, requestTask } from '@/features/tasks/requestsApi';
import { tasksKey } from '@/features/tasks/useTasks';

/** Asks a member to do a task; the board shows the request once refreshed. */
export function useRequestTask(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, memberId }: { taskId: string; memberId: string }) =>
      requestTask(taskId, memberId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKey(userId) }),
  });
}

/**
 * Accepts or declines a request. Refreshes even on failure: the task may have been done or taken
 * meanwhile, which also ends the request.
 */
export function useAnswerTaskRequest(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, accept }: { taskId: string; accept: boolean }) =>
      answerTaskRequest(taskId, accept),
    onSettled: () => queryClient.invalidateQueries({ queryKey: tasksKey(userId) }),
  });
}

/** Withdraws the user's request, or clears one that was declined. */
export function useCancelTaskRequest(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelTaskRequest,
    onSettled: () => queryClient.invalidateQueries({ queryKey: tasksKey(userId) }),
  });
}
