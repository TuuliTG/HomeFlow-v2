import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as statisticsApi from '@/features/statistics/api';

const client = vi.hoisted(() => ({ rpc: vi.fn() }));
const getSupabaseClient = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ getSupabaseClient }));

// setup.ts replaces the statistics api with a fake for every test; this file tests the real one.
const api = await vi.importActual<typeof statisticsApi>('@/features/statistics/api');
const failure = { message: 'boom' };

describe('statistics api', () => {
  beforeEach(() => {
    getSupabaseClient.mockReturnValue(client);
  });

  it("counts each member's tasks since the start of the period, physical and meta work apart", async () => {
    client.rpc.mockResolvedValue({
      data: [
        {
          user_id: 'u1',
          display_name: 'Anna',
          done: 2,
          points: 7,
          created: 3,
          meta_done: 1,
          meta_points: 2,
        },
        {
          user_id: 'u2',
          display_name: null,
          done: 1,
          points: 2,
          created: 0,
          meta_done: 0,
          meta_points: 0,
        },
      ],
      error: null,
    });

    await expect(api.fetchContributions(new Date('2026-10-05T00:00:00Z'))).resolves.toEqual([
      {
        userId: 'u1',
        displayName: 'Anna',
        done: 2,
        points: 7,
        physicalDone: 1,
        physicalPoints: 5,
        metaDone: 1,
        metaPoints: 2,
        created: 3,
      },
      {
        userId: 'u2',
        displayName: null,
        done: 1,
        points: 2,
        physicalDone: 1,
        physicalPoints: 2,
        metaDone: 0,
        metaPoints: 0,
        created: 0,
      },
    ]);
    expect(client.rpc).toHaveBeenCalledWith('household_statistics', {
      since: '2026-10-05T00:00:00.000Z',
    });
  });

  it('counts all time without a start', async () => {
    client.rpc.mockResolvedValue({ data: [], error: null });

    await expect(api.fetchContributions(null)).resolves.toEqual([]);
    expect(client.rpc).toHaveBeenCalledWith('household_statistics', { since: null });
  });

  it('throws when the request fails', async () => {
    client.rpc.mockResolvedValue({ data: null, error: failure });

    await expect(api.fetchContributions(null)).rejects.toBe(failure);
  });
});
