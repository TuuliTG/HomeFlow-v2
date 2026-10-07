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
  return { query, client: { from: vi.fn(() => query), rpc: vi.fn() } };
});

const getSupabaseClient = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ getSupabaseClient }));

// setup.ts replaces the household api with a fake for every test; this file tests the real one.
const api = await vi.importActual<typeof householdApi>('@/features/household/api');
const { client, query } = supabase;
const failure = { message: 'boom', code: '42501' };
const householdRow = { id: 'h1', name: 'The Virtanens', invite_code: 'ABCD2345' };
const household = { id: 'h1', name: 'The Virtanens', inviteCode: 'ABCD2345' };

describe('household api', () => {
  beforeEach(() => {
    getSupabaseClient.mockReturnValue(client);
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
  });

  it("reads the user's household", async () => {
    query.maybeSingle.mockResolvedValue({ data: householdRow, error: null });

    await expect(api.fetchOwnHousehold()).resolves.toEqual(household);
    expect(client.from).toHaveBeenCalledWith('households');
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
    query.order.mockResolvedValue({ data: [{ user_id: 'u2' }, { user_id: 'u1' }], error: null });
    query.in.mockResolvedValue({ data: [{ id: 'u1', display_name: 'Anna' }], error: null });

    await expect(api.fetchHouseholdMembers('h1')).resolves.toEqual([
      { userId: 'u2', displayName: null },
      { userId: 'u1', displayName: 'Anna' },
    ]);
    expect(query.eq).toHaveBeenCalledWith('household_id', 'h1');
    expect(query.order).toHaveBeenCalledWith('joined_at');
    expect(query.in).toHaveBeenCalledWith('id', ['u2', 'u1']);
  });

  it('passes member and profile errors on', async () => {
    query.order.mockResolvedValueOnce({ data: null, error: failure });
    await expect(api.fetchHouseholdMembers('h1')).rejects.toBe(failure);

    query.order.mockResolvedValueOnce({ data: [{ user_id: 'u1' }], error: null });
    query.in.mockResolvedValueOnce({ data: null, error: failure });
    await expect(api.fetchHouseholdMembers('h1')).rejects.toBe(failure);
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
