import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addGoal,
  claimGoalReward,
  deleteGoal,
  fetchGoals,
  fetchGoalSetters,
  updateGoal,
} from '@/features/rewards/api';
import type { Goal, NewGoal } from '@/features/rewards/goal';

const goalsKey = (userId: string) => ['goals', userId] as const;

/** Refetched whenever the Rewards screen opens, so points from tasks done meanwhile show up. */
export function useGoals(userId: string) {
  return useQuery({ queryKey: goalsKey(userId), queryFn: fetchGoals });
}

export function useAddGoal(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (goal: NewGoal) => addGoal(goal),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: goalsKey(userId) }),
  });
}

export function useUpdateGoal(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ goalId, goal }: { goalId: string; goal: NewGoal }) => updateGoal(goalId, goal),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: goalsKey(userId) }),
  });
}

/** The household's members, and whether the user is an adult, who may add, change and delete goals. */
export function useGoalSetters(userId: string) {
  const query = useQuery({ queryKey: [...goalsKey(userId), 'setters'], queryFn: fetchGoalSetters });
  const isAdult = query.data?.some((member) => member.id === userId && !member.isChild) ?? false;
  return { ...query, isAdult };
}

export function useDeleteGoal(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteGoal,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: goalsKey(userId) }),
  });
}

/** Claims rewards; `useLastClaimedGoal()` finds the latest by it. */
const claimGoalRewardKey = ['claim-goal-reward'] as const;

/** What claiming a reward remembers about its goal, to celebrate it afterwards. */
export type ClaimedGoal = Pick<Goal, 'id' | 'title'>;

/** Refreshes even on failure: someone else may have claimed the reward first. */
export function useClaimGoalReward(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: claimGoalRewardKey,
    mutationFn: (goal: ClaimedGoal) => claimGoalReward(goal.id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: goalsKey(userId) }),
  });
}

/**
 * The goal whose reward the user claimed most recently while the app is open, and when (`at`, to tell two
 * claims apart). It outlives the goal card, which moves to the claimed rewards once the goals refresh.
 */
export function useLastClaimedGoal(): { goal: ClaimedGoal; at: number } | undefined {
  const claimed = useMutationState({
    filters: { mutationKey: claimGoalRewardKey, status: 'success' },
    // The key is only used by useClaimGoalReward(), whose variables are a ClaimedGoal.
    select: (mutation) => ({
      goal: mutation.state.variables as ClaimedGoal,
      at: mutation.state.submittedAt,
    }),
  });
  return claimed.at(-1);
}
