import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchHouseholdMembers,
  type HelperShare,
  setTaskHelpers,
} from '@/features/tasks/helpersApi';
import { tasksKey } from '@/features/tasks/useTasks';

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
