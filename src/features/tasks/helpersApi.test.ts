import { describe, expect, it, vi } from 'vitest';

import type * as helpersApi from '@/features/tasks/helpersApi';

const supabase = vi.hoisted(() => {
  const query = { select: vi.fn(), order: vi.fn() };
  query.select.mockReturnValue(query);
  return { query, client: { from: vi.fn(() => query), rpc: vi.fn() } };
});
const fetchDisplayNames = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase', () => ({ getSupabaseClient: () => supabase.client }));
vi.mock('@/features/tasks/api', () => ({ fetchDisplayNames }));

// setup.ts replaces this api with a fake for every test; this file tests the real one.
const api = await vi.importActual<typeof helpersApi>('@/features/tasks/helpersApi');
const { client, query } = supabase;
const failure = { message: 'boom' };

describe('helpers api', () => {
  it("reads the household's members in the order they joined, with their names", async () => {
    query.order.mockResolvedValueOnce({
      data: [{ user_id: 'u1' }, { user_id: 'u2' }],
      error: null,
    });
    fetchDisplayNames.mockResolvedValueOnce(new Map([['u1', 'Anna']]));

    await expect(api.fetchHouseholdMembers()).resolves.toEqual([
      { id: 'u1', name: 'Anna' },
      { id: 'u2', name: null },
    ]);
    expect(client.from).toHaveBeenCalledWith('household_members');
    expect(query.order).toHaveBeenCalledWith('joined_at');
    expect(fetchDisplayNames).toHaveBeenCalledWith(['u1', 'u2']);

    query.order.mockResolvedValueOnce({ data: null, error: failure });
    await expect(api.fetchHouseholdMembers()).rejects.toBe(failure);
  });

  it('sets the helpers and their shares', async () => {
    client.rpc.mockResolvedValueOnce({ data: null, error: null });

    await api.setTaskHelpers('t1', [{ userId: 'u2', points: 2 }]);

    expect(client.rpc).toHaveBeenCalledWith('set_task_helpers', {
      task_id: 't1',
      helpers: [{ user_id: 'u2', points: 2 }],
    });
    client.rpc.mockResolvedValueOnce({ data: null, error: failure });
    await expect(api.setTaskHelpers('t1', [])).rejects.toBe(failure);
  });

  it('reads the tasks the user helped with, with who did them', async () => {
    const row = {
      task_id: 't1',
      title: 'Laundry',
      type: 'physical',
      points: 2,
      completed_at: '2026-10-11T10:00:00Z',
    };
    client.rpc.mockResolvedValueOnce({
      data: [
        { ...row, completed_by: 'u1' },
        { ...row, task_id: 't2', completed_by: null },
      ],
      error: null,
    });
    fetchDisplayNames.mockResolvedValueOnce(new Map([['u1', 'Anna']]));

    const helped = { title: 'Laundry', type: 'physical', points: 2, completedAt: row.completed_at };
    await expect(api.fetchHelpedTasks()).resolves.toEqual([
      { ...helped, id: 't1', doerName: 'Anna' },
      { ...helped, id: 't2', doerName: null },
    ]);
    expect(client.rpc).toHaveBeenCalledWith('own_helped_tasks', { max_tasks: 20 });
    expect(fetchDisplayNames).toHaveBeenCalledWith(['u1']);

    client.rpc.mockResolvedValueOnce({ data: null, error: failure });
    await expect(api.fetchHelpedTasks()).rejects.toBe(failure);
  });
});
