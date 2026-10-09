import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as tasksApi from '@/features/tasks/api';

const supabase = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    is: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    in: vi.fn(),
    insert: vi.fn(),
    not: vi.fn(),
  };
  const channel = { on: vi.fn(), subscribe: vi.fn() };
  return {
    query,
    channel,
    client: {
      from: vi.fn(() => query),
      rpc: vi.fn(),
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
const newTask = {
  title: 'Vacuum',
  description: null,
  type: 'physical',
  points: 3,
  repeatEveryDays: null,
  dueOn: null,
  isPrivate: false,
} as const;
const row = {
  id: 't1',
  title: 'Vacuum',
  description: null,
  type: 'physical',
  points: 3,
  created_by: 'u1',
  repeat_every_days: null,
  due_on: null,
  picked_up_by: null,
  is_private: false,
};

/** The tasks query's result: it is ordered twice (due date, then newest), then awaited. */
function respondWithTasks(result: { data: unknown; error: unknown }) {
  query.order.mockReturnValueOnce(query).mockResolvedValueOnce(result);
}

describe('tasks api', () => {
  beforeEach(() => {
    getSupabaseClient.mockReturnValue(client);
    query.select.mockReturnValue(query);
    query.is.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.not.mockReturnValue(query);
  });

  it('reads open tasks, soonest due first, with the names of who added them', async () => {
    respondWithTasks({
      data: [row, { ...row, id: 't2', created_by: 'u1' }, { ...row, id: 't3', created_by: null }],
      error: null,
    });
    query.in.mockResolvedValue({ data: [{ id: 'u1', display_name: 'Anna' }], error: null });

    const tasks = await api.fetchTasks();

    expect(query.is).toHaveBeenCalledWith('completed_at', null);
    expect(query.order.mock.calls).toEqual([
      ['due_on', { ascending: true, nullsFirst: false }],
      ['created_at', { ascending: false }],
    ]);
    expect(query.in).toHaveBeenCalledWith('id', ['u1']);
    expect(tasks.map((task) => [task.id, task.createdBy, task.creatorName])).toEqual([
      ['t1', 'u1', 'Anna'],
      ['t2', 'u1', 'Anna'],
      ['t3', null, null],
    ]);
    expect(tasks[0]).toMatchObject({
      title: 'Vacuum',
      type: 'physical',
      points: 3,
      repeatEveryDays: null,
      dueOn: null,
      isPrivate: false,
    });
  });

  it('reads who has picked up each task, with their names', async () => {
    respondWithTasks({
      data: [
        { ...row, picked_up_by: 'u2' },
        { ...row, id: 't2', created_by: 'u2' },
      ],
      error: null,
    });
    query.in.mockResolvedValue({ data: [{ id: 'u2', display_name: 'Ben' }], error: null });

    const tasks = await api.fetchTasks();

    expect(query.in).toHaveBeenCalledWith('id', ['u1', 'u2']);
    expect(tasks.map((task) => [task.pickedUpBy, task.pickerName])).toEqual([
      ['u2', 'Ben'],
      [null, null],
    ]);
  });

  it("reads the user's completed tasks, newest first", async () => {
    query.order.mockReturnValueOnce(query);
    query.limit.mockResolvedValueOnce({
      data: [
        {
          id: 't1',
          title: 'Vacuum',
          type: 'physical',
          points: 3,
          completed_at: '2026-10-08T12:00:00Z',
        },
      ],
      error: null,
    });

    const tasks = await api.fetchCompletedTasks('u1');

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
      },
    ]);
  });

  it("reads the household's recently done tasks with who did them", async () => {
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
        },
      ],
      error: null,
    });
    query.in.mockResolvedValueOnce({ data: [{ id: 'u2', display_name: 'Ben' }], error: null });

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
      },
    ]);

    query.order.mockReturnValueOnce(query);
    query.limit.mockResolvedValueOnce({ data: null, error: failure });
    await expect(api.fetchHouseholdCompletedTasks()).rejects.toBe(failure);
  });

  it("adds up the points of the user's completed tasks", async () => {
    query.eq.mockResolvedValueOnce({ data: [{ points: 3 }, { points: 5 }], error: null });

    await expect(api.fetchTotalPoints('u1')).resolves.toBe(8);
    expect(query.select).toHaveBeenCalledWith('points');
    expect(query.eq).toHaveBeenCalledWith('completed_by', 'u1');

    query.eq.mockResolvedValueOnce({ data: null, error: failure });
    await expect(api.fetchTotalPoints('u1')).rejects.toBe(failure);
  });

  it('passes errors on when completed tasks cannot be read', async () => {
    query.order.mockReturnValueOnce(query);
    query.limit.mockResolvedValueOnce({ data: null, error: failure });

    await expect(api.fetchCompletedTasks('u1')).rejects.toBe(failure);
  });

  it.each([
    ['pickUpTask', 'pick_up_task'],
    ['putBackTask', 'put_back_task'],
    ['deleteTask', 'delete_task'],
    ['undoCompleteTask', 'undo_complete_task'],
  ] as const)('%s calls %s and passes errors on', async (name, rpc) => {
    client.rpc.mockResolvedValueOnce({ data: null, error: null });
    await api[name]('t1');
    expect(client.rpc).toHaveBeenCalledWith(rpc, { task_id: 't1' });

    client.rpc.mockResolvedValueOnce({ data: null, error: failure });
    await expect(api[name]('t1')).rejects.toBe(failure);
  });

  it("replaces a task's details", async () => {
    client.rpc.mockResolvedValueOnce({ data: null, error: null });

    await api.updateTask('t1', {
      ...newTask,
      description: 'Use the small nozzle.',
      repeatEveryDays: 7,
      dueOn: '2026-10-10',
    });

    expect(client.rpc).toHaveBeenCalledWith('update_task', {
      task_id: 't1',
      task_title: 'Vacuum',
      task_description: 'Use the small nozzle.',
      task_type: 'physical',
      task_points: 3,
      task_due_on: '2026-10-10',
      task_repeat_every_days: 7,
    });
    client.rpc.mockResolvedValueOnce({ data: null, error: failure });
    await expect(api.updateTask('t1', newTask)).rejects.toBe(failure);
  });

  it('reads how often a task repeats and when it is due', async () => {
    respondWithTasks({
      data: [{ ...row, repeat_every_days: 14, due_on: '2026-10-22' }],
      error: null,
    });
    query.in.mockResolvedValue({ data: [], error: null });

    const [task] = await api.fetchTasks();

    expect(task).toMatchObject({ repeatEveryDays: 14, dueOn: '2026-10-22' });
  });

  it('reads whether a task is private', async () => {
    respondWithTasks({ data: [{ ...row, is_private: true }], error: null });
    query.in.mockResolvedValue({ data: [], error: null });

    const [task] = await api.fetchTasks();

    expect(task).toMatchObject({ isPrivate: true });
  });

  it('skips the name lookup when there are no tasks', async () => {
    respondWithTasks({ data: [], error: null });

    await expect(api.fetchTasks()).resolves.toEqual([]);
    expect(query.in).not.toHaveBeenCalled();
  });

  it('rejects a malformed task row', async () => {
    respondWithTasks({ data: [{ ...row, type: 'chores' }], error: null });

    await expect(api.fetchTasks()).rejects.toThrow();
  });

  it('passes task and name errors on', async () => {
    respondWithTasks({ data: null, error: failure });
    await expect(api.fetchTasks()).rejects.toBe(failure);

    respondWithTasks({ data: [row], error: null });
    query.in.mockResolvedValueOnce({ data: null, error: failure });
    await expect(api.fetchTasks()).rejects.toBe(failure);
  });

  it('adds a task, leaving household and creator to the database', async () => {
    query.insert.mockResolvedValue({ error: null });

    await api.addTask({ ...newTask, repeatEveryDays: 7, dueOn: '2026-10-10', isPrivate: true });

    expect(client.from).toHaveBeenCalledWith('tasks');
    expect(query.insert).toHaveBeenCalledWith({
      title: 'Vacuum',
      description: null,
      type: 'physical',
      points: 3,
      repeat_every_days: 7,
      due_on: '2026-10-10',
      is_private: true,
    });
  });

  it('passes errors on when adding fails', async () => {
    query.insert.mockResolvedValue({ error: failure });

    await expect(api.addTask(newTask)).rejects.toBe(failure);
  });

  it('marks a task done on the given day', async () => {
    client.rpc.mockResolvedValue({ data: null, error: null });

    await api.completeTask('t1', '2026-10-08');

    expect(client.rpc).toHaveBeenCalledWith('complete_task', {
      task_id: 't1',
      completed_on: '2026-10-08',
    });
  });

  it('passes errors on when marking done fails', async () => {
    client.rpc.mockResolvedValue({ data: null, error: failure });

    await expect(api.completeTask('t1', '2026-10-08')).rejects.toBe(failure);
  });

  it('delivers task changes in the household live, until unsubscribed', () => {
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
    const onChange = vi.fn();

    const unsubscribe = api.subscribeToTaskChanges(onChange);
    const [[event, inserts, onInsert], [, updates, onUpdate], [, deletes, onDelete]] = channel.on
      .mock.calls as [
      [string, unknown, (payload: { new: unknown }) => void],
      [string, unknown, () => void],
      [string, unknown, () => void],
    ];
    const inserted = { ...row, household_id: 'h1', created_at: '2026-10-08T04:00:00Z' };
    onInsert({ new: { ...inserted, previous_task_id: null } });
    onInsert({ new: { ...inserted, id: 't2', previous_task_id: 't1' } });
    onInsert({ new: { id: 't3' } });
    onUpdate();
    onDelete();
    unsubscribe();

    expect(client.channel).toHaveBeenCalledWith(expect.stringMatching(/^household-tasks:/));
    expect(event).toBe('postgres_changes');
    expect(inserts).toEqual({ event: 'INSERT', schema: 'public', table: 'tasks' });
    expect(updates).toEqual({ event: 'UPDATE', schema: 'public', table: 'tasks' });
    expect(deletes).toEqual({ event: 'DELETE', schema: 'public', table: 'tasks' });
    expect(onChange.mock.calls).toEqual([
      [{ kind: 'added', id: 't1', title: 'Vacuum', createdBy: 'u1', isRepeat: false }],
      [{ kind: 'added', id: 't2', title: 'Vacuum', createdBy: 'u1', isRepeat: true }],
      [{ kind: 'changed' }],
      [{ kind: 'changed' }],
    ]);
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
  });

  it('warns when live updates cannot connect', () => {
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    api.subscribeToTaskChanges(vi.fn());
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
