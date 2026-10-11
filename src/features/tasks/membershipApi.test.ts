import { describe, expect, it, vi } from 'vitest';

import type * as membershipApi from '@/features/tasks/membershipApi';

const supabase = vi.hoisted(() => {
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return { query, client: { from: vi.fn(() => query) } };
});

vi.mock('@/lib/supabase', () => ({ getSupabaseClient: () => supabase.client }));

// setup.ts replaces this api with a fake for every test; this file tests the real one.
const api = await vi.importActual<typeof membershipApi>('@/features/tasks/membershipApi');
const { client, query } = supabase;

describe('membership api', () => {
  it('reads whether the user is a child and whether they may add tasks', async () => {
    query.maybeSingle.mockResolvedValueOnce({
      data: { is_child: true, can_add_tasks: false },
      error: null,
    });
    await expect(api.fetchMembership('u1')).resolves.toEqual({
      isChild: true,
      canAddTasks: false,
    });
    expect(client.from).toHaveBeenCalledWith('household_members');
    expect(query.select).toHaveBeenCalledWith('is_child, can_add_tasks');
    expect(query.eq).toHaveBeenCalledWith('user_id', 'u1');
  });

  it('lets adults add tasks, and counts someone without a household as an adult', async () => {
    query.maybeSingle.mockResolvedValueOnce({
      data: { is_child: false, can_add_tasks: false },
      error: null,
    });
    await expect(api.fetchMembership('u1')).resolves.toEqual({
      isChild: false,
      canAddTasks: true,
    });

    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(api.fetchMembership('u1')).resolves.toEqual({
      isChild: false,
      canAddTasks: true,
    });
  });

  it('passes errors on', async () => {
    const failure = { message: 'boom' };
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: failure });

    await expect(api.fetchMembership('u1')).rejects.toBe(failure);
  });
});
