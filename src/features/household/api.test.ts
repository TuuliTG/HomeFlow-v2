import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as householdApi from '@/features/household/api';
import { UnknownInviteCodeError } from '@/features/household/household';

const supabase = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    in: vi.fn(),
    maybeSingle: vi.fn(),
  };
  const rpcQuery = { single: vi.fn() };
  return {
    query,
    rpcQuery,
    client: { from: vi.fn(() => query), rpc: vi.fn(), functions: { invoke: vi.fn() } },
  };
});

const getSupabaseClient = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ getSupabaseClient }));

// setup.ts replaces the household api with a fake for every test; this file tests the real one.
const api = await vi.importActual<typeof householdApi>('@/features/household/api');
const { client, query, rpcQuery } = supabase;
const failure = { message: 'boom', code: '42501' };
const householdRow = { id: 'h1', name: 'The Virtanens', invite_code: 'ABCD2345' };
const household = { id: 'h1', name: 'The Virtanens', inviteCode: 'ABCD2345' };

describe('household api', () => {
  beforeEach(() => {
    getSupabaseClient.mockReturnValue(client);
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
  });

  it("reads the user's household with its invite code, which a child doesn't get", async () => {
    query.maybeSingle.mockResolvedValue({ data: { id: 'h1', name: 'The Virtanens' }, error: null });
    client.rpc.mockResolvedValueOnce({ data: 'ABCD2345', error: null });

    await expect(api.fetchOwnHousehold()).resolves.toEqual(household);
    expect(client.from).toHaveBeenCalledWith('households');
    expect(query.select).toHaveBeenCalledWith('id, name');
    expect(client.rpc).toHaveBeenCalledWith('household_invite_code');

    client.rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(api.fetchOwnHousehold()).resolves.toEqual({ ...household, inviteCode: null });

    client.rpc.mockResolvedValueOnce({ data: null, error: failure });
    await expect(api.fetchOwnHousehold()).rejects.toBe(failure);
  });

  it('returns no household when the user has none', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(api.fetchOwnHousehold()).resolves.toBeNull();
  });

  it('rejects a malformed household row', async () => {
    query.maybeSingle.mockResolvedValue({ data: { id: 'h1' }, error: null });

    await expect(api.fetchOwnHousehold()).rejects.toThrow();
  });

  it('lists members in joining order with their display names', async () => {
    query.order.mockResolvedValue({
      data: [
        { user_id: 'u2', is_child: true, signs_in_with_code: true },
        { user_id: 'u1', is_child: false, signs_in_with_code: false },
      ],
      error: null,
    });
    query.in.mockResolvedValue({ data: [{ id: 'u1', display_name: 'Anna' }], error: null });

    await expect(api.fetchHouseholdMembers('h1')).resolves.toEqual([
      { userId: 'u2', displayName: null, isChild: true, signsInWithCode: true },
      { userId: 'u1', displayName: 'Anna', isChild: false, signsInWithCode: false },
    ]);
    expect(query.eq).toHaveBeenCalledWith('household_id', 'h1');
    expect(query.order).toHaveBeenCalledWith('joined_at');
    expect(query.in).toHaveBeenCalledWith('id', ['u2', 'u1']);
  });

  it('passes member and profile errors on', async () => {
    query.order.mockResolvedValueOnce({ data: null, error: failure });
    await expect(api.fetchHouseholdMembers('h1')).rejects.toBe(failure);

    query.order.mockResolvedValueOnce({
      data: [{ user_id: 'u1', is_child: false, signs_in_with_code: false }],
      error: null,
    });
    query.in.mockResolvedValueOnce({ data: null, error: failure });
    await expect(api.fetchHouseholdMembers('h1')).rejects.toBe(failure);
  });

  it('marks a member as a child through the database function', async () => {
    client.rpc.mockResolvedValueOnce({ data: null, error: null });
    await api.setMemberIsChild('u2', true);
    expect(client.rpc).toHaveBeenCalledWith('set_member_is_child', {
      member_id: 'u2',
      is_child: true,
    });

    client.rpc.mockResolvedValueOnce({ data: null, error: failure });
    await expect(api.setMemberIsChild('u2', false)).rejects.toBe(failure);
  });

  it('adds a child through the add-child Edge Function', async () => {
    const signInCode = { code: 'KX7P29QF', expiresAt: '2026-10-11T12:15:00Z' };
    client.functions.invoke.mockResolvedValueOnce({ data: signInCode, error: null });

    await expect(api.addChild('Ben')).resolves.toEqual(signInCode);
    expect(client.functions.invoke).toHaveBeenCalledWith('add-child', {
      body: { displayName: 'Ben' },
    });

    client.functions.invoke.mockResolvedValueOnce({ data: null, error: failure });
    await expect(api.addChild('Ben')).rejects.toBe(failure);
  });

  it('makes a new sign-in code through the database function', async () => {
    client.rpc.mockReturnValue(rpcQuery);
    rpcQuery.single.mockResolvedValueOnce({
      data: { code: 'KX7P29QF', expires_at: '2026-10-11T12:15:00Z' },
      error: null,
    });

    await expect(api.newChildSignInCode('u2')).resolves.toEqual({
      code: 'KX7P29QF',
      expiresAt: '2026-10-11T12:15:00Z',
    });
    expect(client.rpc).toHaveBeenCalledWith('new_child_sign_in_code', { child_id: 'u2' });

    rpcQuery.single.mockResolvedValueOnce({ data: null, error: failure });
    await expect(api.newChildSignInCode('u2')).rejects.toBe(failure);
  });

  it('creates a household through the database function', async () => {
    client.rpc.mockResolvedValue({ data: householdRow, error: null });

    await expect(api.createHousehold('The Virtanens')).resolves.toEqual(household);
    expect(client.rpc).toHaveBeenCalledWith('create_household', {
      household_name: 'The Virtanens',
    });
  });

  it('joins a household through the database function', async () => {
    client.rpc.mockResolvedValue({ data: 'h1', error: null });

    await api.joinHousehold('ABCD2345');

    expect(client.rpc).toHaveBeenCalledWith('join_household', { invite_code: 'ABCD2345' });
  });

  it('tells an unknown invite code apart from other errors', async () => {
    client.rpc.mockResolvedValueOnce({ data: null, error: { message: 'none', code: 'P0002' } });
    await expect(api.joinHousehold('ABCD2345')).rejects.toBeInstanceOf(UnknownInviteCodeError);

    client.rpc.mockResolvedValueOnce({ data: null, error: failure });
    await expect(api.joinHousehold('ABCD2345')).rejects.toBe(failure);
  });

  it('passes household errors on', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: failure });
    client.rpc.mockResolvedValue({ data: null, error: failure });

    await expect(api.fetchOwnHousehold()).rejects.toBe(failure);
    await expect(api.createHousehold('The Virtanens')).rejects.toBe(failure);
  });
});
