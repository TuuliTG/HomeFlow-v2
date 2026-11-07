import {
  createClient,
  FunctionsHttpError,
  isAuthRetryableFetchError,
  type SupabaseClient,
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

/** Whether a Supabase Auth call failed for lack of a connection, so trying again later may work. */
export function isAuthOffline(error: unknown): boolean {
  return isAuthRetryableFetchError(error);
}
