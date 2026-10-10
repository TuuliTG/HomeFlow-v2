import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { addGoal, claimGoalReward, deleteGoal, fetchGoals } from '@/features/rewards/api';
import type { NewGoal } from '@/features/rewards/goal';

const goalsKey = (userId: string) => ['goals', userId] as const;

/** Refetched whenever the Rewards screen opens, so points from tasks done meanwhile show up. */
export function useGoals(userId: string) {
  return useQuery({ queryKey: goalsKey(userId), queryFn: fetchGoals });
}

export function useAddGoal(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (goal: NewGoal) => addGoal(goal, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: goalsKey(userId) }),
  });
}

export function useDeleteGoal(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteGoal,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: goalsKey(userId) }),
  });
}

/** Refreshes even on failure: someone else may have claimed the reward first. */
export function useClaimGoalReward(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: claimGoalReward,
    onSettled: () => queryClient.invalidateQueries({ queryKey: goalsKey(userId) }),
  });
}
