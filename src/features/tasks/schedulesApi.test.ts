import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as schedulesApi from '@/features/tasks/schedulesApi';

const supabase = vi.hoisted(() => {
  const query = { select: vi.fn() };
  return { query, client: { from: vi.fn(() => query), rpc: vi.fn() } };
});

const getSupabaseClient = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ getSupabaseClient }));

// setup.ts replaces the schedules api with a fake for every test; this file tests the real one.
const api = await vi.importActual<typeof schedulesApi>('@/features/tasks/schedulesApi');
const { client, query } = supabase;
const failure = { message: 'boom' };

describe('schedules api', () => {
  beforeEach(() => {
    getSupabaseClient.mockReturnValue(client);
  });

  it("fetches the user's schedule", async () => {
    query.select.mockResolvedValueOnce({
      data: [{ task_id: 't1', starts_at: '2026-10-17T07:00:00+00:00', duration_minutes: 30 }],
      error: null,
    });

    await expect(api.fetchSchedules()).resolves.toEqual([
      { taskId: 't1', startsAt: '2026-10-17T07:00:00+00:00', durationMinutes: 30 },
    ]);
    expect(client.from).toHaveBeenCalledWith('task_schedules');
  });

  it('throws when the schedule cannot be fetched', async () => {
    query.select.mockResolvedValueOnce({ data: null, error: failure });

    await expect(api.fetchSchedules()).rejects.toBe(failure);
  });

  it('schedules a task', async () => {
    client.rpc.mockResolvedValueOnce({ error: null });

    await api.setTaskSchedule({
      taskId: 't1',
      startsAt: '2026-10-17T07:00:00.000Z',
      durationMinutes: 45,
    });

    expect(client.rpc).toHaveBeenCalledWith('set_task_schedule', {
      task_id: 't1',
      starts_at: '2026-10-17T07:00:00.000Z',
      duration_minutes: 45,
    });
  });

  it('throws when a task cannot be scheduled', async () => {
    client.rpc.mockResolvedValueOnce({ error: failure });

    await expect(
      api.setTaskSchedule({ taskId: 't1', startsAt: '2026-10-17T07:00:00Z', durationMinutes: 30 }),
    ).rejects.toBe(failure);
  });

  it('takes a task off the schedule', async () => {
    client.rpc.mockResolvedValueOnce({ error: null });

    await api.clearTaskSchedule('t1');

    expect(client.rpc).toHaveBeenCalledWith('clear_task_schedule', { task_id: 't1' });
  });

  it('throws when a task cannot be taken off the schedule', async () => {
    client.rpc.mockResolvedValueOnce({ error: failure });

    await expect(api.clearTaskSchedule('t1')).rejects.toBe(failure);
  });
});
