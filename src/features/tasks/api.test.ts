import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as tasksApi from '@/features/tasks/api';

const supabase = vi.hoisted(() => {
  const query = { select: vi.fn(), order: vi.fn(), in: vi.fn(), insert: vi.fn() };
  const channel = { on: vi.fn(), subscribe: vi.fn() };
  return {
    query,
    channel,
    client: {
      from: vi.fn(() => query),
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
    },
  };
});

const getSupabaseClient = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ getSupabaseClient }));

// setup.ts replaces the tasks api with a fake for every test; this file tests the real one.
const api = await vi.importActual<typeof tasksApi>('@/features/tasks/api');
const { client, query, channel } = supabase;
const failure = { message: 'boom' };
const row = { id: 't1', title: 'Vacuum', type: 'physical', points: 3, created_by: 'u1' };

describe('tasks api', () => {
  beforeEach(() => {
    getSupabaseClient.mockReturnValue(client);
    query.select.mockReturnValue(query);
  });

  it('reads tasks newest first with the names of who added them', async () => {
    query.order.mockResolvedValue({
      data: [row, { ...row, id: 't2', created_by: 'u1' }, { ...row, id: 't3', created_by: null }],
      error: null,
    });
    query.in.mockResolvedValue({ data: [{ id: 'u1', display_name: 'Anna' }], error: null });

    const tasks = await api.fetchTasks();

    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(query.in).toHaveBeenCalledWith('id', ['u1']);
    expect(tasks.map((task) => [task.id, task.createdBy, task.creatorName])).toEqual([
      ['t1', 'u1', 'Anna'],
      ['t2', 'u1', 'Anna'],
      ['t3', null, null],
    ]);
    expect(tasks[0]).toMatchObject({ title: 'Vacuum', type: 'physical', points: 3 });
  });

  it('skips the name lookup when there are no tasks', async () => {
    query.order.mockResolvedValue({ data: [], error: null });

    await expect(api.fetchTasks()).resolves.toEqual([]);
    expect(query.in).not.toHaveBeenCalled();
  });

  it('rejects a malformed task row', async () => {
    query.order.mockResolvedValue({ data: [{ ...row, type: 'chores' }], error: null });

    await expect(api.fetchTasks()).rejects.toThrow();
  });

  it('passes task and name errors on', async () => {
    query.order.mockResolvedValueOnce({ data: null, error: failure });
    await expect(api.fetchTasks()).rejects.toBe(failure);

    query.order.mockResolvedValueOnce({ data: [row], error: null });
    query.in.mockResolvedValueOnce({ data: null, error: failure });
    await expect(api.fetchTasks()).rejects.toBe(failure);
  });

  it('adds a task, leaving household and creator to the database', async () => {
    query.insert.mockResolvedValue({ error: null });

    await api.addTask({ title: 'Vacuum', type: 'physical', points: 3 });

    expect(client.from).toHaveBeenCalledWith('tasks');
    expect(query.insert).toHaveBeenCalledWith({ title: 'Vacuum', type: 'physical', points: 3 });
  });

  it('passes errors on when adding fails', async () => {
    query.insert.mockResolvedValue({ error: failure });

    await expect(api.addTask({ title: 'Vacuum', type: 'physical', points: 3 })).rejects.toBe(
      failure,
    );
  });

  it('delivers tasks added to the household live, until unsubscribed', () => {
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
    const onAdded = vi.fn();

    const unsubscribe = api.subscribeToNewTasks(onAdded);
    const [[event, filter, listener]] = channel.on.mock.calls as [
      [string, unknown, (payload: { new: unknown }) => void],
    ];
    listener({ new: { ...row, household_id: 'h1', created_at: '2026-10-08T04:00:00Z' } });
    listener({ new: { id: 't2' } });
    unsubscribe();

    expect(client.channel).toHaveBeenCalledWith(expect.stringMatching(/^household-tasks:/));
    expect(event).toBe('postgres_changes');
    expect(filter).toEqual({ event: 'INSERT', schema: 'public', table: 'tasks' });
    expect(onAdded).toHaveBeenCalledExactlyOnceWith({ id: 't1', title: 'Vacuum', createdBy: 'u1' });
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
  });

  it('warns when live updates cannot connect', () => {
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    api.subscribeToNewTasks(vi.fn());
    const [[onStatus]] = channel.subscribe.mock.calls as [
      [(status: string, error?: Error) => void],
    ];
    onStatus('SUBSCRIBED');
    onStatus('CHANNEL_ERROR', new Error('boom'));

    expect(warn).toHaveBeenCalledExactlyOnceWith(
      'Live task updates are unavailable',
      'CHANNEL_ERROR',
      new Error('boom'),
    );
  });
});
