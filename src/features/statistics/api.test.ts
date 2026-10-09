import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as statisticsApi from '@/features/statistics/api';

const supabase = vi.hoisted(() => {
  const query = { select: vi.fn(), in: vi.fn() };
  return { query, client: { from: vi.fn(() => query), rpc: vi.fn() } };
});

const getSupabaseClient = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ getSupabaseClient }));

// setup.ts replaces the statistics api with a fake for every test; this file tests the real one.
const api = await vi.importActual<typeof statisticsApi>('@/features/statistics/api');
const { client, query } = supabase;
const failure = { message: 'boom' };

describe('statistics api', () => {
  beforeEach(() => {
    getSupabaseClient.mockReturnValue(client);
    query.select.mockReturnValue(query);
  });

  it("counts each member's tasks since the start of the period, with their names", async () => {
    client.rpc.mockResolvedValue({
      data: [
        { user_id: 'u1', done: 2, created: 3 },
        { user_id: 'u2', done: 1, created: 0 },
      ],
      error: null,
    });
    query.in.mockResolvedValue({ data: [{ id: 'u1', display_name: 'Anna' }], error: null });

    await expect(api.fetchContributions(new Date('2026-10-05T00:00:00Z'))).resolves.toEqual([
      { userId: 'u1', displayName: 'Anna', done: 2, created: 3 },
      { userId: 'u2', displayName: null, done: 1, created: 0 },
    ]);
    expect(client.rpc).toHaveBeenCalledWith('household_statistics', {
      since: '2026-10-05T00:00:00.000Z',
    });
    expect(client.from).toHaveBeenCalledWith('profiles');
    expect(query.in).toHaveBeenCalledWith('id', ['u1', 'u2']);
  });

  it('counts all time without a start', async () => {
    client.rpc.mockResolvedValue({ data: [], error: null });
    query.in.mockResolvedValue({ data: [], error: null });

    await expect(api.fetchContributions(null)).resolves.toEqual([]);
    expect(client.rpc).toHaveBeenCalledWith('household_statistics', { since: null });
  });

  it('throws when either request fails', async () => {
    client.rpc.mockResolvedValueOnce({ data: null, error: failure });
    await expect(api.fetchContributions(null)).rejects.toBe(failure);

    client.rpc.mockResolvedValueOnce({
      data: [{ user_id: 'u1', done: 0, created: 0 }],
      error: null,
    });
    query.in.mockResolvedValueOnce({ data: null, error: failure });
    await expect(api.fetchContributions(null)).rejects.toBe(failure);
  });
});
