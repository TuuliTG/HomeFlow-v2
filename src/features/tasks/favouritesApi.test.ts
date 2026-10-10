import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as favouritesApi from '@/features/tasks/favouritesApi';

const supabase = vi.hoisted(() => {
  const query = { select: vi.fn(), insert: vi.fn(), delete: vi.fn(), eq: vi.fn() };
  return { query, client: { from: vi.fn(() => query) } };
});

const getSupabaseClient = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ getSupabaseClient }));

// setup.ts replaces the favourites api with a fake for every test; this file tests the real one.
const api = await vi.importActual<typeof favouritesApi>('@/features/tasks/favouritesApi');
const { client, query } = supabase;
const failure = { message: 'boom', code: 'XX000' };

describe('favourites api', () => {
  beforeEach(() => {
    getSupabaseClient.mockReturnValue(client);
    query.delete.mockReturnValue(query);
  });

  it("fetches the names of the household's favourite tasks, each once", async () => {
    query.select.mockResolvedValueOnce({
      data: [{ title_key: 'take out trash' }, { title_key: 'take out trash' }],
      error: null,
    });

    await expect(api.fetchFavouriteTasks()).resolves.toEqual(['take out trash']);
    expect(client.from).toHaveBeenCalledWith('favourite_tasks');
  });

  it('stars a task by its name ignoring case and spaces', async () => {
    query.insert.mockResolvedValueOnce({ error: null });

    await api.setFavouriteTask(' Take Out Trash ', true);

    expect(query.insert).toHaveBeenCalledWith({ title_key: 'take out trash' });
  });

  it('accepts starring a task that is a favourite already', async () => {
    query.insert.mockResolvedValueOnce({ error: { message: 'duplicate', code: '23505' } });

    await expect(api.setFavouriteTask('Vacuum', true)).resolves.toBeUndefined();
  });

  it('unstars a task', async () => {
    query.eq.mockResolvedValueOnce({ error: null });

    await api.setFavouriteTask('Vacuum', false);

    expect(query.eq).toHaveBeenCalledWith('title_key', 'vacuum');
  });

  it('throws when Supabase fails', async () => {
    query.select.mockResolvedValueOnce({ data: null, error: failure });
    query.insert.mockResolvedValueOnce({ error: failure });

    await expect(api.fetchFavouriteTasks()).rejects.toBe(failure);
    await expect(api.setFavouriteTask('Vacuum', true)).rejects.toBe(failure);
  });
});
