import { describe, expect, it, vi } from 'vitest';

import { parsePushPayload } from '@/lib/pushNotification';

import type { DeviceSubscription } from '../_shared/push';
import { type NotifyDependencies, notifyHousehold, parseTaskChange } from './notify';

const task = {
  householdId: 'h1',
  title: 'Book dentist',
  createdBy: 'anna',
  completedBy: null,
  isRepeat: false,
  isPrivate: false,
  forChildren: false,
  assignedTo: null,
};

const adult = (userId: string) => ({ userId, isChild: false });
const added = { taskId: 't1', kind: 'added' } as const;
const completed = { taskId: 't1', kind: 'completed' } as const;

function device(userId: string, endpoint = `https://push.example.com/${userId}`) {
  return { userId, endpoint, p256dh: 'key', auth: 'secret' };
}

function fakeDeps(overrides: Partial<NotifyDependencies> = {}) {
  const subscriptions: Record<string, DeviceSubscription[]> = {
    anna: [device('anna')],
    ben: [
      device('ben', 'https://push.example.com/ben-phone'),
      device('ben', 'https://push.example.com/ben-tablet'),
    ],
    carol: [],
  };
  return {
    taskById: vi.fn((taskId: string) => Promise.resolve(taskId === 't1' ? task : null)),
    membersOf: vi.fn(() =>
      Promise.resolve([adult('anna'), adult('ben'), { userId: 'carol', isChild: true }]),
    ),
    displayNameOf: vi.fn((userId: string) =>
      Promise.resolve(({ anna: 'Anna', ben: 'Ben' } as Record<string, string>)[userId] ?? null),
    ),
    usersWanting: vi.fn((userIds: string[]) => Promise.resolve(userIds)),
    subscriptionsOf: vi.fn((userIds: string[]) =>
      Promise.resolve(userIds.flatMap((userId) => subscriptions[userId] ?? [])),
    ),
    send: vi.fn(() => Promise.resolve(201)),
    forget: vi.fn(() => Promise.resolve()),
    ...overrides,
  } satisfies NotifyDependencies;
}

describe('notify household of an added task', () => {
  it("tells every other adult's devices who added which task", async () => {
    const deps = fakeDeps();

    await expect(notifyHousehold(added, deps)).resolves.toEqual({ sent: 2, removed: 0, failed: 0 });

    expect(deps.usersWanting).toHaveBeenCalledWith(['ben'], 'task_added');
    expect(deps.subscriptionsOf).toHaveBeenCalledWith(['ben']);
    expect(deps.send).toHaveBeenCalledTimes(2);
    expect(deps.send).toHaveBeenCalledWith(device('ben', 'https://push.example.com/ben-phone'), {
      title: 'HomeFlow',
      body: 'Anna added Book dentist',
      url: '/',
    });
  });

  it('sends a message the service worker shows as is', async () => {
    const deps = fakeDeps();
    vi.mocked(deps.taskById).mockResolvedValue({ ...task, title: 'x'.repeat(80) });
    vi.mocked(deps.displayNameOf).mockResolvedValue('y'.repeat(50));

    await notifyHousehold(added, deps);

    const [[, message]] = vi.mocked(deps.send).mock.calls as unknown as [
      [DeviceSubscription, unknown],
    ];
    expect(parsePushPayload(message)).toEqual(message);
  });

  it('does nothing for a task that no longer exists', async () => {
    const deps = fakeDeps();

    await expect(notifyHousehold({ taskId: 'unknown', kind: 'added' }, deps)).resolves.toEqual({
      sent: 0,
      removed: 0,
      failed: 0,
    });
    expect(deps.membersOf).not.toHaveBeenCalled();
  });

  it("doesn't notify anyone about the next occurrence of a repeating task", async () => {
    const deps = fakeDeps();
    vi.mocked(deps.taskById).mockResolvedValue({ ...task, isRepeat: true });

    await expect(notifyHousehold(added, deps)).resolves.toEqual({ sent: 0, removed: 0, failed: 0 });
    expect(deps.send).not.toHaveBeenCalled();
  });

  it("doesn't notify anyone about a private task", async () => {
    const deps = fakeDeps();
    vi.mocked(deps.taskById).mockResolvedValue({ ...task, isPrivate: true });

    await expect(notifyHousehold(added, deps)).resolves.toEqual({ sent: 0, removed: 0, failed: 0 });
    expect(deps.membersOf).not.toHaveBeenCalled();
  });

  it('tells children about tasks available for them', async () => {
    const deps = fakeDeps();
    vi.mocked(deps.taskById).mockResolvedValue({ ...task, forChildren: true });

    await notifyHousehold(added, deps);

    expect(deps.subscriptionsOf).toHaveBeenCalledWith(['ben', 'carol']);
  });

  it('tells only the child an adult gave a task to, of the children', async () => {
    const deps = fakeDeps({
      membersOf: () =>
        Promise.resolve([
          adult('anna'),
          adult('ben'),
          { userId: 'carol', isChild: true },
          { userId: 'dora', isChild: true },
        ]),
    });
    vi.mocked(deps.taskById).mockResolvedValue({ ...task, forChildren: true, assignedTo: 'dora' });

    await notifyHousehold(added, deps);

    expect(deps.subscriptionsOf).toHaveBeenCalledWith(['ben', 'dora']);
  });

  it("doesn't notify anyone when the creator is alone in the household", async () => {
    const deps = fakeDeps({ membersOf: () => Promise.resolve([adult('anna')]) });

    await expect(notifyHousehold(added, deps)).resolves.toEqual({ sent: 0, removed: 0, failed: 0 });
    expect(deps.subscriptionsOf).not.toHaveBeenCalled();
  });

  it('credits "Someone" when the creator has no name or no account any more', async () => {
    const deps = fakeDeps();

    vi.mocked(deps.taskById).mockResolvedValue({ ...task, createdBy: null });

    await notifyHousehold(added, deps);

    expect(deps.displayNameOf).not.toHaveBeenCalled();
    expect(deps.send).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ body: 'Someone added Book dentist' }),
    );
  });
});

describe('notify household of a done task', () => {
  const done = { ...task, completedBy: 'ben' };

  it('tells the other adults who did which task, opening News', async () => {
    const deps = fakeDeps();
    vi.mocked(deps.taskById).mockResolvedValue(done);

    await expect(notifyHousehold(completed, deps)).resolves.toEqual({
      sent: 1,
      removed: 0,
      failed: 0,
    });

    expect(deps.usersWanting).toHaveBeenCalledWith(['anna'], 'task_completed');
    expect(deps.send).toHaveBeenCalledWith(device('anna'), {
      title: 'HomeFlow',
      body: 'Ben did Book dentist',
      url: '/news',
    });
  });

  it("doesn't tell children, who have no News, even about their own tasks", async () => {
    const deps = fakeDeps();
    vi.mocked(deps.taskById).mockResolvedValue({ ...done, forChildren: true, completedBy: 'anna' });

    await notifyHousehold(completed, deps);

    expect(deps.subscriptionsOf).toHaveBeenCalledWith(['ben']);
  });

  it('tells the adults when a child did a task', async () => {
    const deps = fakeDeps();
    vi.mocked(deps.taskById).mockResolvedValue({
      ...done,
      forChildren: true,
      completedBy: 'carol',
    });

    await notifyHousehold(completed, deps);

    expect(deps.subscriptionsOf).toHaveBeenCalledWith(['anna', 'ben']);
  });

  it('tells the next occurrence of a repeating task being done too', async () => {
    const deps = fakeDeps();
    vi.mocked(deps.taskById).mockResolvedValue({ ...done, isRepeat: true });

    await expect(notifyHousehold(completed, deps)).resolves.toMatchObject({ sent: 1 });
  });

  it.each([
    ['a private task', { ...done, isPrivate: true }],
    ['a task undone before the webhook arrived', task],
  ])("doesn't notify anyone about %s", async (_case, stored) => {
    const deps = fakeDeps();
    vi.mocked(deps.taskById).mockResolvedValue(stored);

    await expect(notifyHousehold(completed, deps)).resolves.toEqual({
      sent: 0,
      removed: 0,
      failed: 0,
    });
    expect(deps.membersOf).not.toHaveBeenCalled();
  });

  it('sends nothing to the adults who turned these notifications off', async () => {
    const deps = fakeDeps({ usersWanting: vi.fn(() => Promise.resolve([])) });
    vi.mocked(deps.taskById).mockResolvedValue(done);

    await notifyHousehold(completed, deps);

    expect(deps.send).not.toHaveBeenCalled();
  });
});

describe('webhook payload', () => {
  const record = { id: 't1', household_id: 'h1', title: 'Book dentist', created_by: 'anna' };
  const open = { ...record, completed_at: null };
  const done = { ...record, completed_at: '2026-11-02T10:00:00+00:00' };

  it('reads an inserted task', () => {
    expect(parseTaskChange({ type: 'INSERT', table: 'tasks', record })).toEqual(added);
  });

  it('reads a task marked done', () => {
    expect(
      parseTaskChange({ type: 'UPDATE', table: 'tasks', record: done, old_record: open }),
    ).toEqual(completed);
  });

  it.each([
    ['nothing', undefined],
    ['an edit of an open task', { type: 'UPDATE', table: 'tasks', record: open, old_record: open }],
    ['an edit of a done task', { type: 'UPDATE', table: 'tasks', record: done, old_record: done }],
    ['undoing a task', { type: 'UPDATE', table: 'tasks', record: open, old_record: done }],
    ['an update without the old record', { type: 'UPDATE', table: 'tasks', record: done }],
    ['a delete', { type: 'DELETE', table: 'tasks', old_record: done }],
    ['another table', { type: 'INSERT', table: 'profiles', record }],
    ['no record', { type: 'INSERT', table: 'tasks' }],
    ['a record without an id', { type: 'INSERT', table: 'tasks', record: { title: 'x' } }],
  ])('ignores %s', (_case, payload) => {
    expect(parseTaskChange(payload)).toBeNull();
  });
});
