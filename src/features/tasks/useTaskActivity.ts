import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { fetchTasks, subscribeToTaskChanges } from '@/features/tasks/api';
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
 * add ("Ben added Book dentist"). The user's own tasks, tasks marked done and the next occurrences of
 * repeating tasks refresh the list without a message.
 */
export function useTaskActivity(userId: string) {
  const queryClient = useQueryClient();
  const [activity, setActivity] = useState<TaskActivity | null>(null);

  useEffect(
    () =>
      subscribeToTaskChanges((change) => {
        // Refetch (cancelling any fetch that started before the change), then read the creator's
        // display name from the refreshed list.
        const key = tasksKey(userId);
        const tasks = queryClient
          .invalidateQueries({ queryKey: key })
          .then(() => queryClient.query({ queryKey: key, queryFn: fetchTasks }))
          .catch(() => [] as Task[]);
        if (change.kind !== 'added' || change.isRepeat || change.createdBy === userId) return;
        void tasks.then((list) => {
          const creatorName = list.find((task) => task.id === change.id)?.creatorName;
          setActivity({
            id: change.id,
            message: `${creatorName ?? 'Someone'} added ${change.title}`,
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
