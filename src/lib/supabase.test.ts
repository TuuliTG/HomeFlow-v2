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

describe('functionErrorStatus', () => {
  it('reads the status an Edge Function answered with, and nothing from other errors', async () => {
    const { FunctionsFetchError, FunctionsHttpError } = await import('@supabase/supabase-js');
    const { functionErrorStatus } = await import('@/lib/supabase');

    expect(functionErrorStatus(new FunctionsHttpError(new Response(null, { status: 401 })))).toBe(
      401,
    );
    expect(functionErrorStatus(new FunctionsFetchError('offline'))).toBeNull();
    expect(functionErrorStatus(null)).toBeNull();
  });
});
