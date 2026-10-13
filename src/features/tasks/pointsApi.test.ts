import { describe, expect, it, vi } from 'vitest';

import type * as pointsApi from '@/features/tasks/pointsApi';

const client = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('@/lib/supabase', () => ({ getSupabaseClient: () => client }));

// setup.ts replaces this api with a fake for every test; this file tests the real one.
const api = await vi.importActual<typeof pointsApi>('@/features/tasks/pointsApi');
const failure = { message: 'boom' };

describe('points api', () => {
  it("reads the user's points from the database", async () => {
    client.rpc.mockResolvedValueOnce({ data: 8, error: null });

    await expect(api.fetchTotalPoints()).resolves.toBe(8);
    expect(client.rpc).toHaveBeenCalledWith('own_total_points');

    client.rpc.mockResolvedValueOnce({ data: null, error: failure });
    await expect(api.fetchTotalPoints()).rejects.toBe(failure);
  });
});
