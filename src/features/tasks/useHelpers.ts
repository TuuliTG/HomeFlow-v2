import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchHelpedTasks,
  fetchHouseholdMembers,
  type HelperShare,
  setTaskHelpers,
} from '@/features/tasks/helpersApi';
import { canAskWhoHelped } from '@/features/tasks/task';
import { type DoneTask, tasksKey } from '@/features/tasks/useTasks';

/** The tasks the user helped others with. Under `tasksKey`, like their completed tasks. */
export function useHelpedTasks(userId: string) {
  return useQuery({
    queryKey: [...tasksKey(userId), 'helped'],
    queryFn: fetchHelpedTasks,
  });
}

/** The members of the user's household, who could have helped. Under `tasksKey`, like the board. */
export function useHouseholdMembers(userId: string) {
  return useQuery({
    queryKey: [...tasksKey(userId), 'household-members'],
    queryFn: fetchHouseholdMembers,
  });
}

/** Whether the user is asked who helped with this task they just marked done (`WhoHelpedPrompt`). */
export function useAsksWhoHelped(userId: string, task: DoneTask | undefined): boolean {
  const members = useHouseholdMembers(userId);
  return task !== undefined && canAskWhoHelped(task) && (members.data?.length ?? 0) > 1;
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
