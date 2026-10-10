import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as goalsApi from '@/features/rewards/api';

const supabase = vi.hoisted(() => {
  const query = { insert: vi.fn(), delete: vi.fn(), eq: vi.fn() };
  return { query, client: { from: vi.fn(() => query), rpc: vi.fn() } };
});
const getSupabaseClient = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ getSupabaseClient }));

// setup.ts replaces the goals api with a fake for every test; this file tests the real one.
const api = await vi.importActual<typeof goalsApi>('@/features/rewards/api');
const { client, query } = supabase;
const failure = { message: 'boom' };

describe('goals api', () => {
  beforeEach(() => {
    getSupabaseClient.mockReturnValue(client);
    query.delete.mockReturnValue(query);
  });

  it('reads the goals with their points, telling family goals from personal ones', async () => {
    client.rpc.mockResolvedValue({
      data: [
        {
          id: 'g1',
          title: 'Pizza night',
          target_points: 30,
          owner_id: null,
          created_at: '2026-10-01T10:00:00Z',
          claimed_at: null,
          points: 12,
        },
        {
          id: 'g2',
          title: 'New book',
          target_points: 5,
          owner_id: 'u1',
          created_at: '2026-10-01T10:00:00Z',
          claimed_at: '2026-10-09T10:00:00Z',
          points: 6,
        },
      ],
      error: null,
    });

    await expect(api.fetchGoals()).resolves.toEqual([
      {
        id: 'g1',
        title: 'Pizza night',
        targetPoints: 30,
        scope: 'shared',
        points: 12,
        claimedAt: null,
      },
      {
        id: 'g2',
        title: 'New book',
        targetPoints: 5,
        scope: 'personal',
        points: 6,
        claimedAt: '2026-10-09T10:00:00Z',
      },
    ]);
    expect(client.rpc).toHaveBeenCalledWith('household_goals');
  });

  it('sets a family goal without an owner and a personal goal for the user', async () => {
    query.insert.mockResolvedValue({ error: null });

    await api.addGoal({ title: 'Pizza night', targetPoints: 30, scope: 'shared' }, 'u1');
    await api.addGoal({ title: 'New book', targetPoints: 5, scope: 'personal' }, 'u1');

    expect(client.from).toHaveBeenCalledWith('goals');
    expect(query.insert).toHaveBeenNthCalledWith(1, {
      title: 'Pizza night',
      target_points: 30,
      owner_id: null,
    });
    expect(query.insert).toHaveBeenNthCalledWith(2, {
      title: 'New book',
      target_points: 5,
      owner_id: 'u1',
    });
  });

  it('deletes a goal and claims a reward', async () => {
    query.eq.mockResolvedValue({ error: null });
    client.rpc.mockResolvedValue({ data: null, error: null });

    await api.deleteGoal('g1');
    await api.claimGoalReward('g2');

    expect(query.eq).toHaveBeenCalledWith('id', 'g1');
    expect(client.rpc).toHaveBeenCalledWith('claim_goal_reward', { goal_id: 'g2' });
  });

  it('throws when a request fails', async () => {
    client.rpc.mockResolvedValue({ data: null, error: failure });
    query.insert.mockResolvedValue({ error: failure });
    query.eq.mockResolvedValue({ error: failure });

    await expect(api.fetchGoals()).rejects.toBe(failure);
    await expect(api.claimGoalReward('g1')).rejects.toBe(failure);
    await expect(
      api.addGoal({ title: 'Holiday', targetPoints: 5, scope: 'shared' }, 'u1'),
    ).rejects.toBe(failure);
    await expect(api.deleteGoal('g1')).rejects.toBe(failure);
  });
});
