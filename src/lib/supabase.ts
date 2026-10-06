import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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
