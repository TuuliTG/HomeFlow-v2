import { useQuery } from '@tanstack/react-query';

import { fetchCustomTaskLabels } from '@/features/tasks/labelsApi';
import { tasksKey } from '@/features/tasks/useTasks';

/** The household's own task labels, offered on the task form. Under `tasksKey`, so it refreshes with the board. */
export function useCustomTaskLabels(userId: string) {
  return useQuery({
    queryKey: [...tasksKey(userId), 'custom-labels'],
    queryFn: fetchCustomTaskLabels,
  });
}
