import { z } from 'zod';

import { LoginError, type LoginFailureReason } from '@/features/auth/loginError';
import type { AuthUser } from '@/lib/auth';
import { getSupabaseClient } from '@/lib/supabase';

export interface Profile {
  displayName: string;
}

const profileRowSchema = z.object({ display_name: z.string() });

function toAuthUser(user: { id: string; email?: string }): AuthUser {
  return { id: user.id, email: user.email ?? '' };
}

// Supabase Auth error codes the login form explains; anything else is shown as a generic failure.
const reasonsByCode: Partial<Record<string, LoginFailureReason>> = {
  invalid_credentials: 'wrong-credentials',
  user_already_exists: 'account-exists',
  email_exists: 'account-exists',
  weak_password: 'weak-password',
  email_not_confirmed: 'needs-email-confirmation',
  over_request_rate_limit: 'too-many-attempts',
};

function toLoginError(error: { code?: string | undefined; message: string }): LoginError {
  return new LoginError(reasonsByCode[error.code ?? ''] ?? 'other', error.message);
}

export async function logIn(email: string, password: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  if (error) throw toLoginError(error);
}

/** Creates an account and logs it in. Needs "Confirm email" turned off in Supabase (ADR 0003). */
export async function createAccount(email: string, password: string): Promise<void> {
  const { data, error } = await getSupabaseClient().auth.signUp({ email, password });
  if (error) throw toLoginError(error);
  if (!data.session) {
    throw new LoginError(
      'needs-email-confirmation',
      'Supabase asks new users to confirm their email',
    );
  }
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
