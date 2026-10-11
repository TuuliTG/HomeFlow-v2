import { z } from 'zod';

import { getSupabaseClient } from '@/lib/supabase';

const childRowSchema = z.object({ is_child: z.boolean() }).nullable();

/**
 * Whether an adult in the household has marked the user as a child (`set_member_is_child()`), so they
 * see only tasks for children and every task they add is one.
 */
export async function fetchIsChild(userId: string): Promise<boolean> {
  const { data, error } = await getSupabaseClient()
    .from('household_members')
    .select('is_child')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return childRowSchema.parse(data)?.is_child ?? false;
}
