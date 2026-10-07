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
        signInWithOtp: vi.fn(),
        verifyOtp: vi.fn(),
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

  it('emails a login code that can create the account', async () => {
    auth.signInWithOtp.mockResolvedValue({ error: null });

    await api.sendLoginCode('anna@example.com');

    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'anna@example.com',
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/login` },
    });
  });

  it('verifies the emailed code', async () => {
    auth.verifyOtp.mockResolvedValue({ error: null });

    await api.verifyLoginCode('anna@example.com', '123456');

    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'anna@example.com',
      token: '123456',
      type: 'email',
    });
  });

  it('logs out on this device only', async () => {
    auth.signOut.mockResolvedValue({ error: null });

    await api.logOut();

    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it.each([
    ['sendLoginCode', () => api.sendLoginCode('a@b.c'), auth.signInWithOtp],
    ['verifyLoginCode', () => api.verifyLoginCode('a@b.c', '1'), auth.verifyOtp],
    ['logOut', () => api.logOut(), auth.signOut],
  ])('%s passes Supabase errors on', async (_name, call, method) => {
    method.mockResolvedValue({ error: failure });

    await expect(call()).rejects.toBe(failure);
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
