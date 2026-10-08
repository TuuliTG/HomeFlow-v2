import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addTask,
  completeTask,
  deleteTask,
  fetchCompletedTasks,
  fetchTasks,
  pickUpTask,
  putBackTask,
  undoCompleteTask,
  updateTask,
} from '@/features/tasks/api';
import type { NewTask } from '@/features/tasks/task';
import { today } from '@/features/tasks/dueDate';

export const tasksKey = (userId: string) => ['tasks', userId] as const;

export function useTasks(userId: string) {
  return useQuery({ queryKey: tasksKey(userId), queryFn: fetchTasks });
}

/** The user's recently completed tasks. Under `tasksKey`, so refreshing the board refreshes these too. */
export function useCompletedTasks(userId: string) {
  return useQuery({
    queryKey: [...tasksKey(userId), 'completed'],
    queryFn: () => fetchCompletedTasks(userId),
  });
}

export function useAddTask(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addTask,
    // Stay pending until the list is refreshed, so the board shows the new task straight away.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKey(userId) }),
  });
}

/** Marks a task done today; a repeating task's next occurrence then appears on the board. */
export function useCompleteTask(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => completeTask(taskId, today()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKey(userId) }),
  });
}

/** Picks a task up for the user. Refreshes even on failure: someone else may have taken it first. */
export function usePickUpTask(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: pickUpTask,
    onSettled: () => queryClient.invalidateQueries({ queryKey: tasksKey(userId) }),
  });
}

/** Puts back a task the user picked up. */
export function usePutBackTask(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: putBackTask,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKey(userId) }),
  });
}

export function useUpdateTask(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, task }: { taskId: string; task: NewTask }) => updateTask(taskId, task),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKey(userId) }),
  });
}

export function useDeleteTask(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTask,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKey(userId) }),
  });
}

/** Reopens a task the user marked done recently; it goes back on the board. */
export function useUndoCompleteTask(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: undoCompleteTask,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKey(userId) }),
  });
}
