import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as newsApi from '@/features/news/api';

const supabase = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    in: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
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
  icon: 'vacuum',
  points: 3,
  completed_at: '2026-10-10T08:00:00Z',
  completed_by: 'u2',
  task_helpers: [{ user_id: 'u3', points: 1 }],
  task_likes: [{ user_id: 'u1', emoji: '❤️', created_at: '2026-10-10T09:00:00Z' }],
  task_comments: [
    { id: 'c1', author_id: 'u1', body: 'Thanks!', created_at: '2026-10-10T09:00:00Z' },
    { id: 'c2', author_id: null, body: 'Nice', created_at: '2026-10-10T10:00:00Z' },
  ],
};

/** The news query's result: it is ordered thrice (newest done first, then reactions and comments oldest first). */
function respondWithNews(result: { data: unknown; error: unknown }) {
  query.order.mockReturnValueOnce(query).mockReturnValueOnce(query).mockResolvedValueOnce(result);
}

describe('news api', () => {
  beforeEach(() => {
    getSupabaseClient.mockReturnValue(client);
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.gte.mockReturnValue(query);
    query.or.mockReturnValue(query);
    query.delete.mockReturnValue(query);
    query.update.mockReturnValue(query);
  });

  it('reads shared tasks done since the start, leaving out reminders, with helpers, likes and comments and everyone named', async () => {
    respondWithNews({ data: [row], error: null });
    query.in.mockResolvedValue({
      data: [
        { id: 'u1', display_name: 'Anna' },
        { id: 'u2', display_name: 'Ben' },
        { id: 'u3', display_name: 'Carl' },
      ],
      error: null,
    });

    await expect(api.fetchNews(new Date('2026-10-04T00:00:00Z'))).resolves.toEqual([
      {
        taskId: 't1',
        title: 'Vacuum',
        type: 'physical',
        icon: 'vacuum',
        points: 3,
        completedAt: '2026-10-10T08:00:00Z',
        doneBy: { userId: 'u2', name: 'Ben' },
        helpers: [{ person: { userId: 'u3', name: 'Carl' }, points: 1 }],
        reactions: [{ person: { userId: 'u1', name: 'Anna' }, emoji: '❤️' }],
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
    expect(query.or).toHaveBeenCalledWith('points.is.null,points.gt.0');
    expect(query.gte).toHaveBeenCalledWith('completed_at', '2026-10-04T00:00:00.000Z');
    expect(query.in).toHaveBeenCalledWith('id', ['u2', 'u3', 'u1']);
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

  it('reads an emoji it does not know as a thumbs up', async () => {
    respondWithNews({
      data: [
        { ...row, task_likes: [{ user_id: 'u1', emoji: '🦄', created_at: row.completed_at }] },
      ],
      error: null,
    });
    query.in.mockResolvedValue({ data: [{ id: 'u1', display_name: 'Anna' }], error: null });
    const [item] = await api.fetchNews(new Date());
    expect(item?.reactions).toEqual([{ person: { userId: 'u1', name: 'Anna' }, emoji: '👍' }]);
  });

  it('reacts to a task, changing the emoji when the user has reacted already', async () => {
    query.insert.mockResolvedValueOnce({ error: null });
    await api.reactToTask('t1', '🎉');
    expect(client.from).toHaveBeenCalledWith('task_likes');
    expect(query.insert).toHaveBeenCalledWith({ task_id: 't1', emoji: '🎉' });
    expect(query.update).not.toHaveBeenCalled();

    query.insert.mockResolvedValueOnce({ error: { code: '23505' } });
    query.eq.mockResolvedValueOnce({ error: null });
    await api.reactToTask('t1', '💪');
    expect(query.update).toHaveBeenCalledWith({ emoji: '💪' });
    expect(query.eq).toHaveBeenCalledWith('task_id', 't1');

    query.insert.mockResolvedValueOnce({ error: { code: '23505' } });
    query.eq.mockResolvedValueOnce({ error: failure });
    await expect(api.reactToTask('t1', '💪')).rejects.toBe(failure);

    query.insert.mockResolvedValueOnce({ error: failure });
    await expect(api.reactToTask('t1', '👍')).rejects.toBe(failure);
  });

  it('takes back a reaction', async () => {
    query.eq.mockResolvedValueOnce({ error: null });
    await api.removeReaction('t1');
    expect(query.eq).toHaveBeenCalledWith('task_id', 't1');

    query.eq.mockResolvedValueOnce({ error: failure });
    await expect(api.removeReaction('t1')).rejects.toBe(failure);
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
