import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { pickUpTask } from '@/features/tasks/api';
import { DEFAULT_DURATION_MINUTES, type TaskSchedule } from '@/features/tasks/schedule';
import { clearTaskSchedule, fetchSchedules, setTaskSchedule } from '@/features/tasks/schedulesApi';
import { tasksKey } from '@/features/tasks/useTasks';

const schedulesKey = (userId: string) => [...tasksKey(userId), 'schedules'] as const;

/** When the user plans to do their tasks. Under `tasksKey`, so it refreshes with the board. */
export function useSchedules(userId: string) {
  return useQuery({ queryKey: schedulesKey(userId), queryFn: fetchSchedules });
}

function withoutTask(schedules: TaskSchedule[] | undefined, taskId: string): TaskSchedule[] {
  return (schedules ?? []).filter((schedule) => schedule.taskId !== taskId);
}

/**
 * Schedules or moves a task. The block moves straight away, so a dragged block stays where it was dropped,
 * and the schedule is reloaded once saved, or to undo the move if saving fails.
 */
export function useSetSchedule(userId: string) {
  const queryClient = useQueryClient();
  const queryKey = schedulesKey(userId);
  return useMutation({
    mutationFn: setTaskSchedule,
    onMutate: async (schedule) => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<TaskSchedule[]>(queryKey, (schedules) => [
        ...withoutTask(schedules, schedule.taskId),
        schedule,
      ]);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}

/** Takes a task off the user's schedule. */
export function useClearSchedule(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clearTaskSchedule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: schedulesKey(userId) }),
  });
}

/**
 * Puts a task the user just added from their timetable in it at `startsAt`. A shared task is picked up first,
 * as only the tasks that are the user's to do can be scheduled; a private one already is.
 */
export function usePlanNewTask(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      isPrivate,
      startsAt,
    }: {
      taskId: string;
      isPrivate: boolean;
      startsAt: string;
    }) => {
      if (!isPrivate) await pickUpTask(taskId);
      await setTaskSchedule({ taskId, startsAt, durationMinutes: DEFAULT_DURATION_MINUTES });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: tasksKey(userId) }),
  });
}
