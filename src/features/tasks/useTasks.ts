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
import { fetchFavouriteTasks, setFavouriteTask } from '@/features/tasks/favouritesApi';
import {
  fetchHouseholdMembers,
  type HelperShare,
  setTaskHelpers,
} from '@/features/tasks/helpersApi';
import { fetchMembership } from '@/features/tasks/membershipApi';
import { awardTaskPoints, fetchTasksWaitingForPoints } from '@/features/tasks/pointsApi';
import { clearTaskReminder, fetchReminders, setTaskReminder } from '@/features/tasks/remindersApi';
import { type NewTask, titleKey } from '@/features/tasks/task';
import { today } from '@/lib/dates';

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

/**
 * Whether the user is a child in their household and may add tasks. Under `tasksKey`, so it refreshes
 * with the board.
 */
export function useMembership(userId: string) {
  return useQuery({
    queryKey: [...tasksKey(userId), 'membership'],
    queryFn: () => fetchMembership(userId),
  });
}

const favouritesKey = (userId: string) => [...tasksKey(userId), 'favourites'] as const;

/**
 * The names of the tasks starred in the user's household (`titleKey`). Under `tasksKey`, so it refreshes
 * with the board.
 */
export function useFavouriteTasks(userId: string) {
  return useQuery({ queryKey: favouritesKey(userId), queryFn: fetchFavouriteTasks });
}

/** The favourite names (`titleKey`) with `key` starred or not. */
function withFavourite(keys: string[] | undefined, key: string, isFavourite: boolean): string[] {
  const others = (keys ?? []).filter((other) => other !== key);
  return isFavourite ? [...others, key] : others;
}

/**
 * Stars or unstars a task. The star changes straight away and goes back if saving fails. Several stars
 * can be saving at once: each failure undoes only its own star, and the favourites are reloaded once the
 * last one is saved, so a reload doesn't undo a star still being saved.
 */
export function useSetFavouriteTask(userId: string) {
  const queryClient = useQueryClient();
  const queryKey = favouritesKey(userId);
  return useMutation({
    mutationKey: queryKey,
    mutationFn: ({ title, isFavourite }: { title: string; isFavourite: boolean }) =>
      setFavouriteTask(title, isFavourite),
    onMutate: async ({ title, isFavourite }) => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<string[]>(queryKey, (keys) =>
        withFavourite(keys, titleKey(title), isFavourite),
      );
    },
    onError: (_error, { title, isFavourite }) => {
      queryClient.setQueryData<string[]>(queryKey, (keys) =>
        withFavourite(keys, titleKey(title), !isFavourite),
      );
    },
    onSettled: () =>
      // This mutation still counts as running here.
      queryClient.isMutating({ mutationKey: queryKey }) === 1
        ? queryClient.invalidateQueries({ queryKey })
        : undefined,
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
    queryFn: fetchTotalPoints,
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

/**
 * The user's upcoming reminders. Under `tasksKey`, so putting a task back or marking it done refreshes
 * them. Reminders whose time has passed are being or have been sent, so they are left out.
 */
export function useReminders(userId: string) {
  return useQuery({
    queryKey: [...tasksKey(userId), 'reminders'],
    queryFn: fetchReminders,
    select: (reminders) =>
      reminders.filter((reminder) => new Date(reminder.remindAt).getTime() > Date.now()),
  });
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

/**
 * The household's tasks waiting for an adult to award their points, loaded only for adults (`enabled`).
 * Under `tasksKey`, like the board.
 */
export function useTasksWaitingForPoints(userId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...tasksKey(userId), 'waiting-for-points'],
    queryFn: fetchTasksWaitingForPoints,
    enabled,
  });
}

/** Awards a task's points; the board, totals and statistics refresh with `tasksKey`. */
export function useAwardTaskPoints(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, points }: { taskId: string; points: number }) =>
      awardTaskPoints(taskId, points),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKey(userId) }),
  });
}

/** The members of the user's household, who could have helped. Under `tasksKey`, like the board. */
export function useHouseholdMembers(userId: string) {
  return useQuery({
    queryKey: [...tasksKey(userId), 'household-members'],
    queryFn: fetchHouseholdMembers,
  });
}

/** Says who helped with a task; the user's points and completed tasks refresh with `tasksKey`. */
export function useSetTaskHelpers(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, helpers }: { taskId: string; helpers: HelperShare[] }) =>
      setTaskHelpers(taskId, helpers),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKey(userId) }),
  });
}
