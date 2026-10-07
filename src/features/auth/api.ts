import { z } from 'zod';

import { getSupabaseClient } from '@/lib/supabase';

export interface AuthUser {
  id: string;
  email: string;
}

export interface Profile {
  displayName: string;
}

const profileRowSchema = z.object({ display_name: z.string() });

function toAuthUser(user: { id: string; email?: string }): AuthUser {
  return { id: user.id, email: user.email ?? '' };
}

/**
 * Emails a one-time login code (the email also carries a link back to /login).
 * The account is created on first use, so there is no separate sign-up.
 */
export async function sendLoginCode(email: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/login` },
  });
  if (error) throw error;
}

export async function verifyLoginCode(email: string, code: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw error;
}

/** Logs out on this device only. */
export async function logOut(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut({ scope: 'local' });
  if (error) throw error;
}

/**
 * Calls `onChange` with the current user right away and whenever it changes.
 * Returns an unsubscribe function.
 */
export function subscribeToAuthChanges(onChange: (user: AuthUser | null) => void): () => void {
  let client: ReturnType<typeof getSupabaseClient>;
  try {
    client = getSupabaseClient();
  } catch {
    // Supabase isn't configured (e.g. a preview without env vars): run logged out instead of crashing.
    // Logging in then fails visibly, with the config error from getSupabaseClient().
    onChange(null);
    return () => undefined;
  }
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    onChange(session ? toAuthUser(session.user) : null);
  });
  return () => {
    data.subscription.unsubscribe();
  };
}

export async function fetchOwnProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? { displayName: profileRowSchema.parse(data).display_name } : null;
}

export async function saveOwnProfile(userId: string, displayName: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('profiles')
    .upsert({ id: userId, display_name: displayName });
  if (error) throw error;
}
