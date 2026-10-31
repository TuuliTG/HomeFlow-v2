import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as labelsApi from '@/features/tasks/labelsApi';

const client = vi.hoisted(() => ({ rpc: vi.fn() }));
const getSupabaseClient = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ getSupabaseClient }));

// setup.ts replaces the labels api with a fake for every test; this file tests the real one.
const api = await vi.importActual<typeof labelsApi>('@/features/tasks/labelsApi');
const failure = { message: 'boom' };

describe('labels api', () => {
  beforeEach(() => {
    getSupabaseClient.mockReturnValue(client);
  });

  it("fetches the household's own labels", async () => {
    client.rpc.mockResolvedValueOnce({
      data: [{ label: 'Dishwasher' }, { label: 'Evenings' }],
      error: null,
    });

    await expect(api.fetchCustomTaskLabels()).resolves.toEqual(['Dishwasher', 'Evenings']);
    expect(client.rpc).toHaveBeenCalledWith('custom_task_labels');
  });

  it('passes errors on', async () => {
    client.rpc.mockResolvedValueOnce({ data: null, error: failure });

    await expect(api.fetchCustomTaskLabels()).rejects.toBe(failure);
  });
});
