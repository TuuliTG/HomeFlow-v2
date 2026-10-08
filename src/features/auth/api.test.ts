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
      },
      from: vi.fn(() => query),
    },
  };
});

const getSupabaseClient = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ getSupabaseClient }));

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
    ['over_request_rate_limit', 'other'],
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
});
