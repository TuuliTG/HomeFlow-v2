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
    single: vi.fn(),
  };
  return {
    query,
    client: {
      from: vi.fn(() => query),
      rpc: vi.fn(),
    },
  };
});

const getSupabaseClient = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ getSupabaseClient }));

// setup.ts replaces the tasks api with a fake for every test; this file tests the real one.
const api = await vi.importActual<typeof tasksApi>('@/features/tasks/api');
const { client, query } = supabase;
const failure = { message: 'boom' };
const newTask = {
  title: 'Vacuum',
  description: null,
  type: 'physical',
  points: 3,
  repeatEveryDays: null,
  dueOn: null,
  isPrivate: false,
  forChildren: false,
  icon: null,
  assignedTo: null,
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
  for_children: false,
  icon: null,
  assigned_to: null,
  task_images: [],
  previous: null,
  request: null,
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
      forChildren: true,
      icon: 'vacuum',
      assignedTo: 'ben',
    });

    expect(client.rpc).toHaveBeenCalledWith('update_task', {
      task_id: 't1',
      task_title: 'Vacuum',
      task_description: 'Use the small nozzle.',
      task_type: 'physical',
      task_points: 3,
      task_due_on: '2026-10-10',
      task_repeat_every_days: 7,
      task_for_children: true,
      task_icon: 'vacuum',
      task_assigned_to: 'ben',
      task_change_assignee: true,
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

  it('reads who did the previous occurrence of a repeating shared task, with their name', async () => {
    const previous = { completed_by: 'u2', completed_at: '2026-10-05T09:00:00Z' };
    respondWithTasks({
      data: [
        { ...row, previous },
        { ...row, id: 't2', is_private: true, previous },
        { ...row, id: 't3' },
      ],
      error: null,
    });
    query.in.mockResolvedValue({ data: [{ id: 'u2', display_name: 'Ben' }], error: null });

    const tasks = await api.fetchTasks();

    expect(query.select).toHaveBeenCalledWith(
      expect.stringContaining('previous:previous_occurrence(completed_by, completed_at)'),
    );
    expect(query.in).toHaveBeenCalledWith('id', ['u1', 'u2']);
    expect(tasks.map((task) => task.lastDone)).toEqual([
      { by: 'u2', name: 'Ben', at: '2026-10-05T09:00:00Z' },
      null,
      null,
    ]);
  });

  it('reads who asked whom to do a task, with their names', async () => {
    const request = { requested_by: 'u1', requested_for: 'u2', answer: null };
    respondWithTasks({
      data: [
        { ...row, request },
        { ...row, id: 't2', request: { ...request, answer: 'declined' } },
        { ...row, id: 't3' },
      ],
      error: null,
    });
    query.in.mockResolvedValue({
      data: [
        { id: 'u1', display_name: 'Anna' },
        { id: 'u2', display_name: 'Ben' },
      ],
      error: null,
    });

    const tasks = await api.fetchTasks();

    expect(query.select).toHaveBeenCalledWith(
      expect.stringContaining('request:task_requests(requested_by, requested_for, answer)'),
    );
    expect(query.in).toHaveBeenCalledWith('id', ['u1', 'u2']);
    const asked = {
      requestedBy: 'u1',
      requesterName: 'Anna',
      requestedFor: 'u2',
      askedName: 'Ben',
    };
    expect(tasks.map((task) => task.request)).toEqual([
      { ...asked, answer: null },
      { ...asked, answer: 'declined' },
      null,
    ]);
  });

  it('reads whether a task is private', async () => {
    respondWithTasks({ data: [{ ...row, is_private: true }], error: null });
    query.in.mockResolvedValue({ data: [], error: null });

    const [task] = await api.fetchTasks();

    expect(task).toMatchObject({ isPrivate: true });
  });

  it('reads whether children can do a task', async () => {
    respondWithTasks({ data: [{ ...row, for_children: true }], error: null });
    query.in.mockResolvedValue({ data: [], error: null });

    const [task] = await api.fetchTasks();

    expect(task).toMatchObject({ forChildren: true });
  });

  it('reads which child a task was given to', async () => {
    respondWithTasks({
      data: [{ ...row, for_children: true, assigned_to: 'ben', picked_up_by: 'ben' }],
      error: null,
    });
    query.in.mockResolvedValue({ data: [], error: null });

    const [task] = await api.fetchTasks();

    expect(task).toMatchObject({ assignedTo: 'ben', pickedUpBy: 'ben' });
  });

  it("reads a task's pictures in order", async () => {
    respondWithTasks({
      data: [
        {
          ...row,
          task_images: [
            { path: 'h1/b.jpg', position: 1 },
            { path: 'h1/a.jpg', position: 0 },
          ],
        },
      ],
      error: null,
    });
    query.in.mockResolvedValue({ data: [], error: null });

    const [task] = await api.fetchTasks();

    expect(query.select).toHaveBeenCalledWith(
      expect.stringContaining('task_images(path, position)'),
    );
    expect(task?.images).toEqual(['h1/a.jpg', 'h1/b.jpg']);
  });

  it("reads a task's icon, and one this version doesn't know as none", async () => {
    respondWithTasks({
      data: [
        { ...row, icon: 'vacuum' },
        { ...row, id: 't2', icon: 'rocket' },
      ],
      error: null,
    });
    query.in.mockResolvedValue({ data: [], error: null });

    const tasks = await api.fetchTasks();

    expect(tasks.map((task) => task.icon)).toEqual(['vacuum', null]);
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

  it('adds a task, leaving household and creator to the database, and returns its id', async () => {
    query.insert.mockReturnValue(query);
    query.single.mockResolvedValue({ data: { id: 't9' }, error: null });

    const id = await api.addTask({
      ...newTask,
      repeatEveryDays: 7,
      dueOn: '2026-10-10',
      forChildren: true,
      icon: 'vacuum',
      assignedTo: 'ben',
    });

    expect(client.from).toHaveBeenCalledWith('tasks');
    expect(query.insert).toHaveBeenCalledWith({
      title: 'Vacuum',
      description: null,
      type: 'physical',
      points: 3,
      repeat_every_days: 7,
      due_on: '2026-10-10',
      is_private: false,
      for_children: true,
      icon: 'vacuum',
      assigned_to: 'ben',
    });
    expect(query.select).toHaveBeenCalledWith('id');
    expect(id).toBe('t9');
  });

  it('passes errors on when adding fails', async () => {
    query.insert.mockReturnValue(query);
    query.single.mockResolvedValue({ data: null, error: failure });

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
});
