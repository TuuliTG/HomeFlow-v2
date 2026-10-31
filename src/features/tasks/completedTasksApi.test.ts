import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as completedTasksApi from '@/features/tasks/completedTasksApi';

const supabase = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    in: vi.fn(),
    not: vi.fn(),
  };
  return { query, client: { from: vi.fn(() => query) } };
});

const getSupabaseClient = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ getSupabaseClient }));

// setup.ts replaces the completed tasks api with a fake for every test; this file tests the real one.
const api = await vi.importActual<typeof completedTasksApi>('@/features/tasks/completedTasksApi');
const { client, query } = supabase;
const failure = { message: 'boom' };

describe('completed tasks api', () => {
  beforeEach(() => {
    getSupabaseClient.mockReturnValue(client);
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.not.mockReturnValue(query);
  });

  it("reads the user's completed tasks, newest first, with who helped", async () => {
    query.order.mockReturnValueOnce(query);
    query.limit.mockResolvedValueOnce({
      data: [
        {
          id: 't1',
          title: 'Vacuum',
          type: 'physical',
          points: 3,
          completed_at: '2026-10-08T12:00:00Z',
          task_helpers: [{ user_id: 'u2', points: 1 }],
        },
      ],
      error: null,
    });
    query.in.mockResolvedValueOnce({ data: [{ id: 'u2', display_name: 'Ben' }], error: null });

    const tasks = await api.fetchCompletedTasks('u1');

    expect(query.select).toHaveBeenCalledWith(
      'id, title, type, points, completed_at, task_helpers(user_id, points)',
    );
    expect(query.eq).toHaveBeenCalledWith('completed_by', 'u1');
    expect(query.order).toHaveBeenCalledWith('completed_at', { ascending: false });
    expect(query.limit).toHaveBeenCalledWith(20);
    expect(tasks).toEqual([
      {
        id: 't1',
        title: 'Vacuum',
        type: 'physical',
        points: 3,
        completedAt: '2026-10-08T12:00:00Z',
        helpers: [{ userId: 'u2', name: 'Ben', points: 1 }],
      },
    ]);
  });

  it("reads the household's recently done tasks with who did them and who helped", async () => {
    query.order.mockReturnValueOnce(query);
    query.limit.mockResolvedValueOnce({
      data: [
        {
          id: 't1',
          title: 'Vacuum',
          type: 'physical',
          points: 3,
          completed_at: '2026-10-08T12:00:00Z',
          completed_by: 'u2',
          task_helpers: [{ user_id: 'u3', points: 2 }],
        },
      ],
      error: null,
    });
    query.in.mockResolvedValueOnce({
      data: [
        { id: 'u2', display_name: 'Ben' },
        { id: 'u3', display_name: 'Carl' },
      ],
      error: null,
    });

    const tasks = await api.fetchHouseholdCompletedTasks();

    expect(query.not).toHaveBeenCalledWith('completed_at', 'is', null);
    expect(query.order).toHaveBeenCalledWith('completed_at', { ascending: false });
    expect(query.limit).toHaveBeenCalledWith(30);
    expect(tasks).toEqual([
      {
        id: 't1',
        title: 'Vacuum',
        type: 'physical',
        points: 3,
        completedAt: '2026-10-08T12:00:00Z',
        completedBy: 'u2',
        completerName: 'Ben',
        helpers: [{ userId: 'u3', name: 'Carl', points: 2 }],
      },
    ]);

    query.order.mockReturnValueOnce(query);
    query.limit.mockResolvedValueOnce({ data: null, error: failure });
    await expect(api.fetchHouseholdCompletedTasks()).rejects.toBe(failure);
  });

  it('passes errors on when completed tasks cannot be read', async () => {
    query.order.mockReturnValueOnce(query);
    query.limit.mockResolvedValueOnce({ data: null, error: failure });

    await expect(api.fetchCompletedTasks('u1')).rejects.toBe(failure);
  });
});
