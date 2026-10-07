import { z } from 'zod';

import {
  type Household,
  type HouseholdMember,
  UnknownInviteCodeError,
} from '@/features/household/household';
import { getSupabaseClient } from '@/lib/supabase';

// Postgres error raised by join_household() for an unknown code.
const NO_DATA_FOUND = 'P0002';

const householdRowSchema = z.object({ id: z.string(), name: z.string(), invite_code: z.string() });
const memberRowsSchema = z.array(z.object({ user_id: z.string() }));
const profileRowsSchema = z.array(z.object({ id: z.string(), display_name: z.string() }));

function toHousehold(row: unknown): Household {
  const { id, name, invite_code } = householdRowSchema.parse(row);
  return { id, name, inviteCode: invite_code };
}

/** The logged-in user's household (Row Level Security only shows their own), or null. */
export async function fetchOwnHousehold(): Promise<Household | null> {
  const { data, error } = await getSupabaseClient()
    .from('households')
    .select('id, name, invite_code')
    .maybeSingle();
  if (error) throw error;
  return data ? toHousehold(data) : null;
}

/** Members in the order they joined, with the display names they have chosen. */
export async function fetchHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
  const client = getSupabaseClient();
  const members = await client
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId)
    .order('joined_at');
  if (members.error) throw members.error;
  const userIds = memberRowsSchema.parse(members.data).map((row) => row.user_id);

  const profiles = await client.from('profiles').select('id, display_name').in('id', userIds);
  if (profiles.error) throw profiles.error;
  const names = new Map(
    profileRowsSchema.parse(profiles.data).map((row) => [row.id, row.display_name]),
  );
  return userIds.map((userId) => ({ userId, displayName: names.get(userId) ?? null }));
}

/** Creates a household with the user as its first member. */
export async function createHousehold(name: string): Promise<Household> {
  // Without generated database types the function's result is untyped; Zod checks it.
  const result = await getSupabaseClient().rpc('create_household', { household_name: name });
  if (result.error) throw result.error;
  return toHousehold(result.data);
}

export async function joinHousehold(inviteCode: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('join_household', { invite_code: inviteCode });
  if (error?.code === NO_DATA_FOUND) throw new UnknownInviteCodeError();
  if (error) throw error;
}
