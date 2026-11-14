import { z } from 'zod';

import type { SessionTokens } from '@/features/auth/deviceAccounts';
import { LoginError, type LoginFailureReason } from '@/features/auth/loginError';
import type { AuthUser } from '@/lib/auth';
import {
  functionErrorStatus,
  getSupabaseClient,
  getThrowawaySupabaseClient,
  isSessionEnded,
} from '@/lib/supabase';

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

const childSignInSchema = z.object({ tokenHash: z.string() });

/**
 * Trades the one-time code an adult gave a child without email for a token like a magic link's, which signs
 * them in with `verifyOtp` (`child-sign-in` Edge Function, ADR 0003).
 */
async function childTokenHash(code: string): Promise<string> {
  const result = await getSupabaseClient().functions.invoke<unknown>('child-sign-in', {
    body: { code },
  });
  // functions-js types its error as any; it is a FunctionsError.
  const error = result.error as Error | null;
  if (functionErrorStatus(error) === 401) {
    throw new LoginError('unknown-child-code', 'Unknown, used or expired code');
  }
  if (error) throw error;
  return childSignInSchema.parse(result.data).tokenHash;
}

/** Signs a child without email in with their sign-in code. */
export async function signInWithChildCode(code: string): Promise<void> {
  const tokenHash = await childTokenHash(code);
  const verified = await getSupabaseClient().auth.verifyOtp({
    token_hash: tokenHash,
    type: 'email',
  });
  if (verified.error) throw toLoginError(verified.error);
}

/**
 * Signs a child without email in with their sign-in code on a throwaway client, so the account in use stays,
 * and hands over the child's session to keep on this device.
 */
export async function childSessionFromCode(code: string): Promise<SessionTokens> {
  const tokenHash = await childTokenHash(code);
  const verified = await getThrowawaySupabaseClient().auth.verifyOtp({
    token_hash: tokenHash,
    type: 'email',
  });
  if (verified.error) throw toLoginError(verified.error);
  const { session } = verified.data;
  if (!session) throw new LoginError('other', 'Signing the child in gave no session');
  return {
    userId: session.user.id,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  };
}

/**
 * Ends a session kept on this device, so its tokens no longer sign in anywhere. A session that has already
 * ended needs nothing more.
 */
export async function endKeptSession(tokens: SessionTokens): Promise<void> {
  const throwaway = getThrowawaySupabaseClient();
  const tried = await throwaway.auth.setSession({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });
  if (tried.error) {
    if (isSessionEnded(tried.error)) return;
    throw tried.error;
  }
  const { error } = await throwaway.auth.signOut({ scope: 'local' });
  if (error) throw error;
}

/** Logs out on this device only. */
export async function logOut(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut({ scope: 'local' });
  if (error) throw error;
}

/** What signs the current account back in later, or null when logged out (ADR 0003). */
export async function currentSessionTokens(): Promise<SessionTokens | null> {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  const { session } = data;
  return (
    session && {
      userId: session.user.id,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
    }
  );
}

/**
 * Continues as an account kept on this device, in place of the current one, which stays valid. Resolves to
 * false, leaving the current account in use, if the kept session has ended (e.g. it logged out on another
 * device); throws if it couldn't tell (e.g. offline).
 */
export async function signInWithTokens(tokens: SessionTokens): Promise<boolean> {
  // Try the session out on a throwaway client first: one the app's client found ended would log out the
  // account in use. This also refreshes an expired session, so the app's client gets a working one.
  const tried = await getThrowawaySupabaseClient().auth.setSession({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });
  if (tried.error) {
    if (isSessionEnded(tried.error)) return false;
    throw tried.error;
  }
  if (!tried.data.session || tried.data.user?.id !== tokens.userId) return false;
  const { error } = await getSupabaseClient().auth.setSession(tried.data.session);
  if (error) throw error;
  return true;
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
