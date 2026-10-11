import { z } from 'zod';

import { getSupabaseClient } from '@/lib/supabase';

/** What the user may do with tasks, as the adults in their household decided (ADR 0003). */
export interface Membership {
  /** Children see only tasks for children, and every task they add is one. */
  isChild: boolean;
  /** Adults always; a child only when an adult lets them (`set_member_can_add_tasks()`). */
  canAddTasks: boolean;
}

const membershipRowSchema = z
  .object({ is_child: z.boolean(), can_add_tasks: z.boolean() })
  .nullable();

/** The user's membership; someone without a household counts as an adult, like the database. */
export async function fetchMembership(userId: string): Promise<Membership> {
  const { data, error } = await getSupabaseClient()
    .from('household_members')
    .select('is_child, can_add_tasks')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  const row = membershipRowSchema.parse(data);
  const isChild = row?.is_child ?? false;
  return { isChild, canAddTasks: !isChild || (row?.can_add_tasks ?? false) };
}
