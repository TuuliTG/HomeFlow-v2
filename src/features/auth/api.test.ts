import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as authApi from '@/features/auth/api';

const supabase = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    upsert: vi.fn(),
  };
  return {
    query,
    client: {
      auth: {
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
        onAuthStateChange: vi.fn(),
        verifyOtp: vi.fn(),
        getSession: vi.fn(),
        setSession: vi.fn(),
      },
      from: vi.fn(() => query),
      functions: { invoke: vi.fn() },
    },
  };
});

const getSupabaseClient = vi.hoisted(() => vi.fn());
const throwawayAuth = vi.hoisted(() => ({
  setSession: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({
  getSupabaseClient,
  getThrowawaySupabaseClient: () => ({ auth: throwawayAuth }),
  // Tests describe an ended session as an error with code `session_not_found`.
  isSessionEnded: (error: { code?: string }) => error.code === 'session_not_found',
  // Tests describe an Edge Function's answer as an error with its status.
  functionErrorStatus: (error: { status?: number } | null) => error?.status ?? null,
}));

// setup.ts replaces the auth api with a fake for every test; this file tests the real one.
const api = await vi.importActual<typeof authApi>('@/features/auth/api');
const { auth } = supabase.client;
const { query } = supabase;
const failure = { message: 'boom' };

describe('auth api', () => {
  beforeEach(() => {
    getSupabaseClient.mockReturnValue(supabase.client);
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
  });

  it('signs a child in with their code, through the child-sign-in Edge Function', async () => {
    supabase.client.functions.invoke.mockResolvedValueOnce({
      data: { tokenHash: 'token-hash' },
      error: null,
    });
    auth.verifyOtp.mockResolvedValueOnce({ error: null });

    await api.signInWithChildCode('KX7P-29QF');

    expect(supabase.client.functions.invoke).toHaveBeenCalledWith('child-sign-in', {
      body: { code: 'KX7P-29QF' },
    });
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'token-hash', type: 'email' });
  });

  it('explains an unknown child code and passes other failures on', async () => {
    supabase.client.functions.invoke.mockResolvedValueOnce({ data: null, error: { status: 401 } });
    await expect(api.signInWithChildCode('ABCD-EFGH')).rejects.toMatchObject({
      reason: 'unknown-child-code',
    });

    const offline = { message: 'offline' };
    supabase.client.functions.invoke.mockResolvedValueOnce({ data: null, error: offline });
    await expect(api.signInWithChildCode('ABCD-EFGH')).rejects.toBe(offline);

    supabase.client.functions.invoke.mockResolvedValueOnce({
      data: { tokenHash: 'token-hash' },
      error: null,
    });
    auth.verifyOtp.mockResolvedValueOnce({ error: { code: 'otp_expired', message: 'Expired' } });
    await expect(api.signInWithChildCode('KX7P-29QF')).rejects.toMatchObject({ reason: 'other' });
  });

  it("signs a child in on a throwaway client, handing over their session and leaving the app's alone", async () => {
    supabase.client.functions.invoke.mockResolvedValueOnce({
      data: { tokenHash: 'token-hash' },
      error: null,
    });
    throwawayAuth.verifyOtp.mockResolvedValueOnce({
      data: { session: { access_token: 'a', refresh_token: 'r', user: { id: 'ben' } } },
      error: null,
    });

    await expect(api.childSessionFromCode('KX7P-29QF')).resolves.toEqual({
      userId: 'ben',
      accessToken: 'a',
      refreshToken: 'r',
    });
    expect(throwawayAuth.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'token-hash',
      type: 'email',
    });
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('logs in with email and password', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });

    await api.logIn('anna@example.com', 'secret password');

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'anna@example.com',
      password: 'secret password',
    });
  });

  it('creates an account that is logged in straight away', async () => {
    auth.signUp.mockResolvedValue({ data: { session: {} }, error: null });

    await api.createAccount('anna@example.com', 'secret password');

    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'anna@example.com',
      password: 'secret password',
    });
  });

  it('reports when Supabase wants the email confirmed before logging in', async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });

    await expect(api.createAccount('anna@example.com', 'secret password')).rejects.toMatchObject({
      reason: 'needs-email-confirmation',
    });
  });

  it.each([
    ['invalid_credentials', 'wrong-credentials'],
    ['user_already_exists', 'account-exists'],
    ['email_exists', 'account-exists'],
    ['weak_password', 'weak-password'],
    ['email_not_confirmed', 'needs-email-confirmation'],
    ['over_request_rate_limit', 'too-many-attempts'],
    ['validation_failed', 'other'],
    [undefined, 'other'],
  ])('explains the Supabase error %s as %s', async (code, reason) => {
    auth.signInWithPassword.mockResolvedValue({ error: { code, message: 'boom' } });
    auth.signUp.mockResolvedValue({ data: { session: null }, error: { code, message: 'boom' } });

    const expected = { name: 'LoginError', reason, message: 'boom' };
    await expect(api.logIn('a@b.c', 'pw')).rejects.toMatchObject(expected);
    await expect(api.createAccount('a@b.c', 'pw')).rejects.toMatchObject(expected);
  });

  it('logs out on this device only', async () => {
    auth.signOut.mockResolvedValue({ error: null });

    await api.logOut();

    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('passes log-out errors on', async () => {
    auth.signOut.mockResolvedValue({ error: failure });

    await expect(api.logOut()).rejects.toBe(failure);
  });

  it('reports the logged-in user and stops listening on unsubscribe', () => {
    const unsubscribe = vi.fn();
    auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } });
    const onChange = vi.fn();

    const stop = api.subscribeToAuthChanges(onChange);
    const [[listener]] = auth.onAuthStateChange.mock.calls as [[(e: string, s: unknown) => void]];
    listener('SIGNED_IN', { user: { id: 'u1', email: 'anna@example.com' } });
    listener('SIGNED_OUT', null);
    stop();

    expect(onChange).toHaveBeenNthCalledWith(1, { id: 'u1', email: 'anna@example.com' });
    expect(onChange).toHaveBeenNthCalledWith(2, null);
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('reports nobody logged in when Supabase is not configured', () => {
    getSupabaseClient.mockImplementation(() => {
      throw new Error('Invalid or missing environment variables');
    });
    const onChange = vi.fn();

    const stop = api.subscribeToAuthChanges(onChange);

    expect(onChange).toHaveBeenCalledWith(null);
    expect(stop).not.toThrow();
  });

  it('reads the own profile', async () => {
    query.maybeSingle.mockResolvedValue({ data: { display_name: 'Anna' }, error: null });

    await expect(api.fetchOwnProfile('u1')).resolves.toEqual({ displayName: 'Anna' });
    expect(supabase.client.from).toHaveBeenCalledWith('profiles');
    expect(query.eq).toHaveBeenCalledWith('id', 'u1');
  });

  it('returns no profile when none has been saved', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(api.fetchOwnProfile('u1')).resolves.toBeNull();
  });

  it('rejects a malformed profile row', async () => {
    query.maybeSingle.mockResolvedValue({ data: { display_name: 42 }, error: null });

    await expect(api.fetchOwnProfile('u1')).rejects.toThrow();
  });

  it('passes profile errors on', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: failure });
    query.upsert.mockResolvedValue({ error: failure });

    await expect(api.fetchOwnProfile('u1')).rejects.toBe(failure);
    await expect(api.saveOwnProfile('u1', 'Anna')).rejects.toBe(failure);
  });

  it('saves the display name for the user', async () => {
    query.upsert.mockResolvedValue({ error: null });

    await api.saveOwnProfile('u1', 'Anna');

    expect(query.upsert).toHaveBeenCalledWith({ id: 'u1', display_name: 'Anna' });
  });

  describe('switching to an account kept on this device', () => {
    const kept = { userId: 'ben', accessToken: 'old-access', refreshToken: 'old-refresh' };
    const fresh = { access_token: 'new-access', refresh_token: 'new-refresh', user: { id: 'ben' } };

    it('reads the tokens of the account in use', async () => {
      auth.getSession.mockResolvedValueOnce({
        data: { session: { ...fresh, user: { id: 'anna' } } },
        error: null,
      });

      await expect(api.currentSessionTokens()).resolves.toEqual({
        userId: 'anna',
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });
    });

    it('tries the session out first, then hands the working one to the app', async () => {
      throwawayAuth.setSession.mockResolvedValueOnce({
        data: { session: fresh, user: fresh.user },
        error: null,
      });
      auth.setSession.mockResolvedValueOnce({ data: {}, error: null });

      await expect(api.signInWithTokens(kept)).resolves.toBe(true);
      expect(throwawayAuth.setSession).toHaveBeenCalledWith({
        access_token: 'old-access',
        refresh_token: 'old-refresh',
      });
      expect(auth.setSession).toHaveBeenCalledWith(fresh);
    });

    it('leaves the account in use alone when the kept session has ended', async () => {
      throwawayAuth.setSession.mockResolvedValueOnce({
        data: { session: null, user: null },
        error: { code: 'session_not_found', message: 'Session not found' },
      });

      await expect(api.signInWithTokens(kept)).resolves.toBe(false);
      expect(auth.setSession).not.toHaveBeenCalled();
    });

    it('ends a kept session, unless it has already ended', async () => {
      throwawayAuth.setSession.mockResolvedValueOnce({ data: { session: fresh }, error: null });
      throwawayAuth.signOut.mockResolvedValueOnce({ error: null });
      await api.endKeptSession(kept);
      expect(throwawayAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });

      throwawayAuth.signOut.mockClear();
      throwawayAuth.setSession.mockResolvedValueOnce({
        data: { session: null },
        error: { code: 'session_not_found', message: 'Session not found' },
      });
      await api.endKeptSession(kept);
      expect(throwawayAuth.signOut).not.toHaveBeenCalled();

      throwawayAuth.setSession.mockResolvedValueOnce({ data: { session: null }, error: failure });
      await expect(api.endKeptSession(kept)).rejects.toBe(failure);
    });

    it("throws when it can't tell, e.g. offline", async () => {
      throwawayAuth.setSession.mockResolvedValueOnce({
        data: { session: null, user: null },
        error: failure,
      });

      await expect(api.signInWithTokens(kept)).rejects.toBe(failure);
      expect(auth.setSession).not.toHaveBeenCalled();
    });
  });
});
