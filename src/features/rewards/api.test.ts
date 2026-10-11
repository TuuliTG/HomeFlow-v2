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

  it('reads the goals with their points, telling shared goals from personal ones and whose they are', async () => {
    client.rpc.mockResolvedValue({
      data: [
        {
          id: 'g1',
          title: 'Pizza night',
          target_points: 30,
          owner_id: null,
          owner_name: null,
          created_at: '2026-10-01T10:00:00Z',
          claimed_at: null,
          points: 12,
          reached: false,
          participants: [
            { user_id: 'u1', display_name: 'Anna', points: 9, min_points: null },
            { user_id: 'u2', display_name: null, points: 3, min_points: 5 },
          ],
        },
        {
          id: 'g2',
          title: 'New book',
          target_points: 5,
          owner_id: 'u1',
          owner_name: 'Anna',
          created_at: '2026-10-01T10:00:00Z',
          claimed_at: '2026-10-09T10:00:00Z',
          points: 6,
          reached: true,
          participants: null,
        },
      ],
      error: null,
    });

    await expect(api.fetchGoals()).resolves.toEqual([
      {
        id: 'g1',
        title: 'Pizza night',
        targetPoints: 30,
        owner: null,
        points: 12,
        participants: [
          { id: 'u1', name: 'Anna', points: 9, minPoints: null },
          { id: 'u2', name: null, points: 3, minPoints: 5 },
        ],
        reached: false,
        claimedAt: null,
      },
      {
        id: 'g2',
        title: 'New book',
        targetPoints: 5,
        owner: { id: 'u1', name: 'Anna' },
        points: 6,
        participants: [],
        reached: true,
        claimedAt: '2026-10-09T10:00:00Z',
      },
    ]);
    expect(client.rpc).toHaveBeenCalledWith('household_goals');
  });

  it('sets a shared goal with its participants and their minimums, and a personal goal for a member', async () => {
    client.rpc.mockResolvedValue({ data: 'g1', error: null });
    query.insert.mockResolvedValue({ error: null });

    await api.addGoal({
      title: 'Pizza night',
      targetPoints: 30,
      scope: 'shared',
      ownerId: null,
      participants: [
        { userId: 'u1', minPoints: null },
        { userId: 'u2', minPoints: 5 },
      ],
    });
    await api.addGoal({
      title: 'New book',
      targetPoints: 5,
      scope: 'personal',
      ownerId: 'u1',
      participants: [],
    });

    expect(client.rpc).toHaveBeenCalledWith('add_shared_goal', {
      title: 'Pizza night',
      target_points: 30,
      participants: [
        { user_id: 'u1', min_points: null },
        { user_id: 'u2', min_points: 5 },
      ],
    });
    expect(client.from).toHaveBeenCalledWith('goals');
    expect(query.insert).toHaveBeenCalledExactlyOnceWith({
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
      api.addGoal({
        title: 'Holiday',
        targetPoints: 5,
        scope: 'personal',
        ownerId: 'u1',
        participants: [],
      }),
    ).rejects.toBe(failure);
    await expect(api.deleteGoal('g1')).rejects.toBe(failure);
  });
});
