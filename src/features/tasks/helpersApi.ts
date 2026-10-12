import { z } from 'zod';

import { fetchDisplayNames } from '@/features/tasks/api';
import { getSupabaseClient } from '@/lib/supabase';

/** Someone in the user's household who could have helped with a task. */
export interface HouseholdMember {
  id: string;
  /** Their display name, if they have chosen one. */
  name: string | null;
}

/** A helper's share of a task's points, as chosen by whoever marked it done. */
export interface HelperShare {
  userId: string;
  points: number;
}

const memberRowsSchema = z.array(z.object({ user_id: z.string() }));

/** The members of the user's household in the order they joined, with their names. */
export async function fetchHouseholdMembers(): Promise<HouseholdMember[]> {
  const { data, error } = await getSupabaseClient()
    .from('household_members')
    .select('user_id')
    .order('joined_at');
  if (error) throw error;
  const ids = memberRowsSchema.parse(data).map((row) => row.user_id);
  const names = await fetchDisplayNames(ids);
  return ids.map((id) => ({ id, name: names.get(id) ?? null }));
}

/**
 * Says who helped with a shared task the user marked done in the last week, replacing earlier helpers;
 * their shares come out of the task's points (`set_task_helpers()`).
 */
export async function setTaskHelpers(taskId: string, helpers: HelperShare[]): Promise<void> {
  const { error } = await getSupabaseClient().rpc('set_task_helpers', {
    task_id: taskId,
    helpers: helpers.map(({ userId, points }) => ({ user_id: userId, points })),
  });
  if (error) throw error;
}
