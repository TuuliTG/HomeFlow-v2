// Household lookups the notifying Edge Functions share (ADR 0005), read with the service role. Type-checked with
// `deno check`, like the index.ts files that use them.
import { supabase } from './supabaseAdmin.ts';

/** Everyone in the household, and whether each is a child. */
export async function membersOf(
  householdId: string,
): Promise<{ userId: string; isChild: boolean }[]> {
  const { data, error } = await supabase
    .from('household_members')
    .select('user_id, is_child')
    .eq('household_id', householdId);
  if (error) throw error;
  return data.map((row: { user_id: string; is_child: boolean }) => ({
    userId: row.user_id,
    isChild: row.is_child,
  }));
}

/** The member's name, or null once their account is deleted. */
export async function displayNameOf(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as { display_name: string } | null)?.display_name ?? null;
}
