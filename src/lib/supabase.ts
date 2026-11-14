import {
  createClient,
  FunctionsHttpError,
  isAuthApiError,
  isAuthSessionMissingError,
  type SupabaseClient,
  type SupabaseClientOptions,
} from '@supabase/supabase-js';

import { parseEnv } from '@/lib/env';

let client: SupabaseClient | undefined;

/**
 * Single access point to Supabase. Created lazily so screens that don't need data
 * (and tests) work without environment variables. Feature `api` modules call this;
 * components never do.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    const env = parseEnv(import.meta.env);
    client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  }
  return client;
}

/** The HTTP status an Edge Function answered with when `functions.invoke()` failed, or null if it didn't answer. */
export function functionErrorStatus(error: unknown): number | null {
  return error instanceof FunctionsHttpError ? (error.context as Response).status : null;
}

/**
 * A client that keeps its session in memory only, to try out a session before the app's own client takes it:
 * a session the app's client finds ended there makes it log out the user in use.
 */
export function getThrowawaySupabaseClient(): SupabaseClient {
  const env = parseEnv(import.meta.env);
  const options: SupabaseClientOptions<'public'> = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'homeflow-throwaway',
    },
  };
  const throwaway = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, options);
  return throwaway;
}

/** Supabase Auth error codes meaning a session is gone for good, so its tokens can be forgotten. */
const sessionEndedCodes = new Set([
  'refresh_token_not_found',
  'refresh_token_already_used',
  'session_not_found',
  'session_expired',
  'user_not_found',
]);

/**
 * Whether a Supabase Auth call failed because the session has ended (e.g. logged out elsewhere), rather than
 * for a reason that may pass, such as a lost connection or too many requests.
 */
export function isSessionEnded(error: unknown): boolean {
  return (
    isAuthSessionMissingError(error) ||
    (isAuthApiError(error) && sessionEndedCodes.has(error.code ?? ''))
  );
}
