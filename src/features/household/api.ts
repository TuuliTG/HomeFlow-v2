import { z } from 'zod';

import {
  type Household,
  type HouseholdMember,
  type SignInCode,
  UnknownInviteCodeError,
} from '@/features/household/household';
import { getSupabaseClient } from '@/lib/supabase';

// Postgres error raised by join_household() for an unknown code.
const NO_DATA_FOUND = 'P0002';

const householdRowSchema = z.object({ id: z.string(), name: z.string(), invite_code: z.string() });
const memberRowsSchema = z.array(
  z.object({ user_id: z.string(), is_child: z.boolean(), signs_in_with_code: z.boolean() }),
);
const ownHouseholdRowSchema = z.object({ id: z.string(), name: z.string() });
const signInCodeSchema = z.object({ code: z.string(), expires_at: z.string() });
const profileRowsSchema = z.array(z.object({ id: z.string(), display_name: z.string() }));

function toHousehold(row: unknown): Household {
  const { id, name, invite_code } = householdRowSchema.parse(row);
  return { id, name, inviteCode: invite_code };
}

/**
 * The logged-in user's household (Row Level Security only shows their own), or null. Its invite code
 * comes from `household_invite_code()`, which children don't get.
 */
export async function fetchOwnHousehold(): Promise<Household | null> {
  const client = getSupabaseClient();
  const household = await client.from('households').select('id, name').maybeSingle();
  if (household.error) throw household.error;
  if (!household.data) return null;
  const inviteCode = await client.rpc('household_invite_code');
  if (inviteCode.error) throw inviteCode.error;
  return {
    ...ownHouseholdRowSchema.parse(household.data),
    inviteCode: z.string().nullable().parse(inviteCode.data),
  };
}

/** Members in the order they joined, with the display names they have chosen. */
export async function fetchHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
  const client = getSupabaseClient();
  const members = await client
    .from('household_members')
    .select('user_id, is_child, signs_in_with_code')
    .eq('household_id', householdId)
    .order('joined_at');
  if (members.error) throw members.error;
  const rows = memberRowsSchema.parse(members.data);
  const userIds = rows.map((row) => row.user_id);

  const profiles = await client.from('profiles').select('id, display_name').in('id', userIds);
  if (profiles.error) throw profiles.error;
  const names = new Map(
    profileRowsSchema.parse(profiles.data).map((row) => [row.id, row.display_name]),
  );
  return rows.map(({ user_id, is_child, signs_in_with_code }) => ({
    userId: user_id,
    displayName: names.get(user_id) ?? null,
    isChild: is_child,
    signsInWithCode: signs_in_with_code,
  }));
}

/**
 * Adds a child without email to the user's household (`add-child` Edge Function, ADR 0003) and returns
 * the code they sign in with on their own device.
 */
export async function addChild(displayName: string): Promise<SignInCode> {
  const result = await getSupabaseClient().functions.invoke<unknown>('add-child', {
    body: { displayName },
  });
  // functions-js types its error as any; it is a FunctionsError.
  const error = result.error as Error | null;
  if (error) throw error;
  return z.object({ code: z.string(), expiresAt: z.string() }).parse(result.data);
}

/** A new sign-in code for a child who signs in with codes; any earlier one stops working. */
export async function newChildSignInCode(childId: string): Promise<SignInCode> {
  const { data, error } = await getSupabaseClient()
    .rpc('new_child_sign_in_code', { child_id: childId })
    .single();
  if (error) throw error;
  const { code, expires_at } = signInCodeSchema.parse(data);
  return { code, expiresAt: expires_at };
}

/**
 * Marks another member of the user's household as a child or an adult. Only adults can, and not for
 * themselves; a new child gives back the adults-only tasks they picked up.
 */
export async function setMemberIsChild(memberId: string, isChild: boolean): Promise<void> {
  const { error } = await getSupabaseClient().rpc('set_member_is_child', {
    member_id: memberId,
    is_child: isChild,
  });
  if (error) throw error;
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
