import { afterEach, describe, expect, it, vi } from 'vitest';

describe('getSupabaseClient', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('creates the client once and reuses it', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'key');
    const { getSupabaseClient } = await import('@/lib/supabase');

    expect(getSupabaseClient()).toBe(getSupabaseClient());
  });

  it('fails fast when configuration is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const { getSupabaseClient } = await import('@/lib/supabase');

    expect(() => getSupabaseClient()).toThrow(/Invalid or missing environment variables/);
  });
});
