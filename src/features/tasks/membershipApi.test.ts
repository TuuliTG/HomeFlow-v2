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
  it("reads whether the user is a child, and an adult's missing row as not", async () => {
    query.maybeSingle.mockResolvedValueOnce({ data: { is_child: true }, error: null });
    await expect(api.fetchIsChild('u1')).resolves.toBe(true);
    expect(client.from).toHaveBeenCalledWith('household_members');
    expect(query.select).toHaveBeenCalledWith('is_child');
    expect(query.eq).toHaveBeenCalledWith('user_id', 'u1');

    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(api.fetchIsChild('u1')).resolves.toBe(false);
  });

  it('passes errors on', async () => {
    const failure = { message: 'boom' };
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: failure });

    await expect(api.fetchIsChild('u1')).rejects.toBe(failure);
  });
});
