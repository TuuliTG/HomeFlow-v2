import { z } from 'zod';

import type { Goal, GoalSetter, NewGoal } from '@/features/rewards/goal';
import { getSupabaseClient } from '@/lib/supabase';

const goalRowsSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    target_points: z.number(),
    owner_id: z.string().nullable(),
    owner_name: z.string().nullable(),
    claimed_at: z.string().nullable(),
    points: z.number(),
    reached: z.boolean(),
    participants: z
      .array(
        z.object({
          user_id: z.string(),
          display_name: z.string().nullable(),
          points: z.number(),
          min_points: z.number().nullable(),
        }),
      )
      .nullable(),
  }),
);

/**
 * The household's shared goals and every member's personal goals, with the points towards each and
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
    points: row.points,
    participants: (row.participants ?? []).map(({ user_id, display_name, points, min_points }) => ({
      id: user_id,
      name: display_name,
      points,
      minPoints: min_points,
    })),
    reached: row.reached,
    claimedAt: row.claimed_at,
  }));
}

/**
 * Sets a goal shared by the chosen members, each with their minimum, or a personal goal for one member;
 * only adults can.
 */
export async function addGoal({ title, targetPoints, ownerId, participants }: NewGoal) {
  const client = getSupabaseClient();
  const { error } =
    ownerId === null
      ? await client.rpc('add_shared_goal', {
          title,
          target_points: targetPoints,
          participants: participants.map(({ userId, minPoints }) => ({
            user_id: userId,
            min_points: minPoints,
          })),
        })
      : await client
          .from('goals')
          .insert({ title, target_points: targetPoints, owner_id: ownerId });
  if (error) throw error;
}

const memberRowsSchema = z.array(z.object({ user_id: z.string(), is_child: z.boolean() }));
const profileRowsSchema = z.array(z.object({ id: z.string(), display_name: z.string() }));

/** The household's members in the order they joined, with their names and who is a child. */
export async function fetchGoalSetters(): Promise<GoalSetter[]> {
  const client = getSupabaseClient();
  const members = await client
    .from('household_members')
    .select('user_id, is_child')
    .order('joined_at');
  if (members.error) throw members.error;
  const rows = memberRowsSchema.parse(members.data);
  const profiles = await client
    .from('profiles')
    .select('id, display_name')
    .in(
      'id',
      rows.map((row) => row.user_id),
    );
  if (profiles.error) throw profiles.error;
  const names = new Map(
    profileRowsSchema.parse(profiles.data).map((row) => [row.id, row.display_name]),
  );
  return rows.map(({ user_id, is_child }) => ({
    id: user_id,
    name: names.get(user_id) ?? null,
    isChild: is_child,
  }));
}

/** Deletes an open goal; only adults can, and claimed goals stay as history. */
export async function deleteGoal(goalId: string): Promise<void> {
  const { error } = await getSupabaseClient().from('goals').delete().eq('id', goalId);
  if (error) throw error;
}

/** Claims the reward of a reached goal; the database checks it is reached and not yet claimed. */
export async function claimGoalReward(goalId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('claim_goal_reward', { goal_id: goalId });
  if (error) throw error;
}
