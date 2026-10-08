import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { fetchTasks, subscribeToNewTasks } from '@/features/tasks/api';
import type { Task } from '@/features/tasks/task';
import { tasksKey } from '@/features/tasks/useTasks';

/** How long a message stays up unless dismissed. */
export const TASK_ACTIVITY_DURATION_MS = 6000;

export interface TaskActivity {
  id: string;
  message: string;
}

/**
 * Keeps the task list current while the app is open, and describes tasks other household members
 * add ("Ben added Book dentist"). The user's own tasks refresh the list without a message.
 */
export function useTaskActivity(userId: string) {
  const queryClient = useQueryClient();
  const [activity, setActivity] = useState<TaskActivity | null>(null);

  useEffect(
    () =>
      subscribeToNewTasks((added) => {
        // Refetch (cancelling any fetch that started before the insert), then read the creator's
        // display name from the refreshed list.
        const key = tasksKey(userId);
        const tasks = queryClient
          .invalidateQueries({ queryKey: key })
          .then(() => queryClient.query({ queryKey: key, queryFn: fetchTasks }))
          .catch(() => [] as Task[]);
        if (added.createdBy === userId) return;
        void tasks.then((list) => {
          const creatorName = list.find((task) => task.id === added.id)?.creatorName;
          setActivity({
            id: added.id,
            message: `${creatorName ?? 'Someone'} added ${added.title}`,
          });
        });
      }),
    [queryClient, userId],
  );

  const dismiss = useCallback(() => {
    setActivity(null);
  }, []);

  return { activity, dismiss };
}
