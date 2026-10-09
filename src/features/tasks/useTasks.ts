import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addTask,
  completeTask,
  deleteTask,
  fetchCompletedTasks,
  fetchHouseholdCompletedTasks,
  fetchTasks,
  fetchTaskSuggestions,
  fetchTotalPoints,
  pickUpTask,
  putBackTask,
  undoCompleteTask,
  updateTask,
} from '@/features/tasks/api';
import { clearTaskReminder, fetchReminders, setTaskReminder } from '@/features/tasks/remindersApi';
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

/** Tasks the household has added before. Under `tasksKey`, so it refreshes with the board. */
export function useTaskSuggestions(userId: string) {
  return useQuery({
    queryKey: [...tasksKey(userId), 'suggestions'],
    queryFn: fetchTaskSuggestions,
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

/** The household's recently done tasks. */
export function useHouseholdCompletedTasks(userId: string) {
  return useQuery({
    queryKey: [...tasksKey(userId), 'household-completed'],
    queryFn: fetchHouseholdCompletedTasks,
  });
}

/** The user's points from all the tasks they've done. Under `tasksKey`, so it refreshes with the board. */
export function useTotalPoints(userId: string) {
  return useQuery({
    queryKey: [...tasksKey(userId), 'points'],
    queryFn: () => fetchTotalPoints(userId),
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

/** The user's reminders. Under `tasksKey`, so putting a task back or marking it done refreshes them. */
export function useReminders(userId: string) {
  return useQuery({ queryKey: [...tasksKey(userId), 'reminders'], queryFn: fetchReminders });
}

export function useSetReminder(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, remindAt }: { taskId: string; remindAt: string }) =>
      setTaskReminder(taskId, remindAt),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKey(userId) }),
  });
}

export function useClearReminder(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clearTaskReminder,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKey(userId) }),
  });
}
