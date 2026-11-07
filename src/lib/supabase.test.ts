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

describe('isSessionEnded', () => {
  it('forgets a session only when Supabase Auth says it is gone', async () => {
    const { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError, AuthUnknownError } =
      await import('@supabase/supabase-js');
    const { isSessionEnded } = await import('@/lib/supabase');

    expect(isSessionEnded(new AuthSessionMissingError())).toBe(true);
    expect(isSessionEnded(new AuthApiError('Gone', 400, 'refresh_token_not_found'))).toBe(true);
    expect(isSessionEnded(new AuthApiError('Gone', 403, 'session_not_found'))).toBe(true);
    expect(isSessionEnded(new AuthApiError('Slow down', 429, 'over_request_rate_limit'))).toBe(
      false,
    );
    expect(isSessionEnded(new AuthRetryableFetchError('Failed to fetch', 0))).toBe(false);
    expect(isSessionEnded(new AuthUnknownError('Not JSON', null))).toBe(false);
    expect(isSessionEnded(new Error('Network error'))).toBe(false);
  });
});
