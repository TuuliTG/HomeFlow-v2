import { z } from 'zod';

import type { Goal, NewGoal } from '@/features/rewards/goal';
import { getSupabaseClient } from '@/lib/supabase';

const goalRowsSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    target_points: z.number(),
    owner_id: z.string().nullable(),
    owner_name: z.string().nullable(),
    min_points_per_member: z.number().nullable(),
    claimed_at: z.string().nullable(),
    points: z.number(),
    reached: z.boolean(),
    member_points: z
      .array(
        z.object({ user_id: z.string(), display_name: z.string().nullable(), points: z.number() }),
      )
      .nullable(),
  }),
);

/**
 * The household's family goals and every member's personal goals, with the points towards each and
 * whether each is reached: open goals first (newest first), then claimed ones. Counted by
 * `household_goals()` in the database, which also decides whether a goal is reached.
 */
export async function fetchGoals(): Promise<Goal[]> {
  // Without generated database types the function's result is untyped; Zod checks it.
  const result = await getSupabaseClient().rpc('household_goals');
  if (result.error) throw result.error;
  return goalRowsSchema.parse(result.data).map((row) => ({
    id: row.id,
    title: row.title,
    targetPoints: row.target_points,
    owner: row.owner_id === null ? null : { id: row.owner_id, name: row.owner_name },
    minPointsPerMember: row.min_points_per_member,
    points: row.points,
    memberPoints: (row.member_points ?? []).map(({ user_id, display_name, points }) => ({
      id: user_id,
      name: display_name,
      points,
    })),
    reached: row.reached,
    claimedAt: row.claimed_at,
  }));
}

/** Sets a goal for the family, or for `userId` alone. */
export async function addGoal(
  { title, targetPoints, scope, minPointsPerMember }: NewGoal,
  userId: string,
) {
  const { error } = await getSupabaseClient()
    .from('goals')
    .insert({
      title,
      target_points: targetPoints,
      owner_id: scope === 'personal' ? userId : null,
      min_points_per_member: minPointsPerMember,
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
