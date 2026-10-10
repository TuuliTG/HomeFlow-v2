import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as newsApi from '@/features/news/api';

const supabase = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    order: vi.fn(),
    in: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  };
  return { query, client: { from: vi.fn(() => query) } };
});
const getSupabaseClient = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ getSupabaseClient }));

// setup.ts replaces the news api with a fake for every test; this file tests the real one.
const api = await vi.importActual<typeof newsApi>('@/features/news/api');
const { client, query } = supabase;
const failure = { message: 'boom' };
const row = {
  id: 't1',
  title: 'Vacuum',
  type: 'physical',
  points: 3,
  completed_at: '2026-10-10T08:00:00Z',
  completed_by: 'u2',
  task_likes: [{ user_id: 'u1' }],
  task_comments: [
    { id: 'c1', author_id: 'u1', body: 'Thanks!', created_at: '2026-10-10T09:00:00Z' },
    { id: 'c2', author_id: null, body: 'Nice', created_at: '2026-10-10T10:00:00Z' },
  ],
};

/** The news query's result: it is ordered twice (newest done first, then comments oldest first). */
function respondWithNews(result: { data: unknown; error: unknown }) {
  query.order.mockReturnValueOnce(query).mockResolvedValueOnce(result);
}

describe('news api', () => {
  beforeEach(() => {
    getSupabaseClient.mockReturnValue(client);
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.gte.mockReturnValue(query);
    query.delete.mockReturnValue(query);
  });

  it('reads shared tasks done since the start, with their likes and comments and everyone named', async () => {
    respondWithNews({ data: [row], error: null });
    query.in.mockResolvedValue({
      data: [
        { id: 'u1', display_name: 'Anna' },
        { id: 'u2', display_name: 'Ben' },
      ],
      error: null,
    });

    await expect(api.fetchNews(new Date('2026-10-04T00:00:00Z'))).resolves.toEqual([
      {
        taskId: 't1',
        title: 'Vacuum',
        type: 'physical',
        points: 3,
        completedAt: '2026-10-10T08:00:00Z',
        doneBy: { userId: 'u2', name: 'Ben' },
        likedBy: [{ userId: 'u1', name: 'Anna' }],
        comments: [
          {
            id: 'c1',
            author: { userId: 'u1', name: 'Anna' },
            body: 'Thanks!',
            createdAt: '2026-10-10T09:00:00Z',
          },
          {
            id: 'c2',
            author: { userId: null, name: null },
            body: 'Nice',
            createdAt: '2026-10-10T10:00:00Z',
          },
        ],
      },
    ]);
    expect(client.from).toHaveBeenCalledWith('tasks');
    expect(query.eq).toHaveBeenCalledWith('is_private', false);
    expect(query.gte).toHaveBeenCalledWith('completed_at', '2026-10-04T00:00:00.000Z');
    expect(query.in).toHaveBeenCalledWith('id', ['u2', 'u1']);
  });

  it('asks for no names when nothing was done', async () => {
    respondWithNews({ data: [], error: null });

    await expect(api.fetchNews(new Date())).resolves.toEqual([]);
    expect(query.in).not.toHaveBeenCalled();
  });

  it('throws when reading the news or the names fails', async () => {
    respondWithNews({ data: null, error: failure });
    await expect(api.fetchNews(new Date())).rejects.toBe(failure);

    respondWithNews({ data: [row], error: null });
    query.in.mockResolvedValue({ data: null, error: failure });
    await expect(api.fetchNews(new Date())).rejects.toBe(failure);
  });

  it('likes a task, ignoring a like that is already there', async () => {
    query.insert.mockResolvedValueOnce({ error: null });
    await api.likeTask('t1');
    expect(client.from).toHaveBeenCalledWith('task_likes');
    expect(query.insert).toHaveBeenCalledWith({ task_id: 't1' });

    query.insert.mockResolvedValueOnce({ error: { code: '23505' } });
    await expect(api.likeTask('t1')).resolves.toBeUndefined();

    query.insert.mockResolvedValueOnce({ error: failure });
    await expect(api.likeTask('t1')).rejects.toBe(failure);
  });

  it('takes back a like', async () => {
    query.eq.mockResolvedValueOnce({ error: null });
    await api.unlikeTask('t1');
    expect(query.eq).toHaveBeenCalledWith('task_id', 't1');

    query.eq.mockResolvedValueOnce({ error: failure });
    await expect(api.unlikeTask('t1')).rejects.toBe(failure);
  });

  it('adds a trimmed comment', async () => {
    query.insert.mockResolvedValueOnce({ error: null });
    await api.addComment('t1', '  Thank you!  ');
    expect(client.from).toHaveBeenCalledWith('task_comments');
    expect(query.insert).toHaveBeenCalledWith({ task_id: 't1', body: 'Thank you!' });

    query.insert.mockResolvedValueOnce({ error: failure });
    await expect(api.addComment('t1', 'Hi')).rejects.toBe(failure);
  });

  it('deletes a comment', async () => {
    query.eq.mockResolvedValueOnce({ error: null });
    await api.deleteComment('c1');
    expect(query.eq).toHaveBeenCalledWith('id', 'c1');

    query.eq.mockResolvedValueOnce({ error: failure });
    await expect(api.deleteComment('c1')).rejects.toBe(failure);
  });
});
