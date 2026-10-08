import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { addTask, completeTask, fetchTasks } from '@/features/tasks/api';
import { today } from '@/features/tasks/dueDate';

export const tasksKey = (userId: string) => ['tasks', userId] as const;

export function useTasks(userId: string) {
  return useQuery({ queryKey: tasksKey(userId), queryFn: fetchTasks });
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
