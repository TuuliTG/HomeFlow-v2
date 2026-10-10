import { z } from 'zod';

import type { Goal, NewGoal } from '@/features/rewards/goal';
import { getSupabaseClient } from '@/lib/supabase';

const goalRowsSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    target_points: z.number(),
    owner_id: z.string().nullable(),
    claimed_at: z.string().nullable(),
    points: z.number(),
  }),
);

/**
 * The household's family goals and the user's own goals, with the points towards each: open goals
 * first (newest first), then claimed ones. Counted by `household_goals()` in the database.
 */
export async function fetchGoals(): Promise<Goal[]> {
  // Without generated database types the function's result is untyped; Zod checks it.
  const result = await getSupabaseClient().rpc('household_goals');
  if (result.error) throw result.error;
  return goalRowsSchema
    .parse(result.data)
    .map(({ target_points, owner_id, claimed_at, ...goal }) => ({
      ...goal,
      targetPoints: target_points,
      scope: owner_id === null ? 'shared' : 'personal',
      claimedAt: claimed_at,
    }));
}

/** Sets a goal for the family, or for `userId` alone. */
export async function addGoal({ title, targetPoints, scope }: NewGoal, userId: string) {
  const { error } = await getSupabaseClient()
    .from('goals')
    .insert({
      title,
      target_points: targetPoints,
      owner_id: scope === 'personal' ? userId : null,
    });
  if (error) throw error;
}

/** Deletes an open goal; claimed goals stay as history. */
export async function deleteGoal(goalId: string): Promise<void> {
  const { error } = await getSupabaseClient().from('goals').delete().eq('id', goalId);
  if (error) throw error;
}

/** Claims the reward of a reached goal; the database checks it is reached and not yet claimed. */
export async function claimGoalReward(goalId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('claim_goal_reward', { goal_id: goalId });
  if (error) throw error;
}
