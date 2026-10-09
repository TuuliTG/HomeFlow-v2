import { describe, expect, it, vi } from 'vitest';

import { parsePushPayload } from '@/lib/pushNotification';

import type { DeviceSubscription } from '../_shared/push';
import { type NotifyDependencies, notifyHousehold, parseAddedTaskId } from './notify';

const task = {
  householdId: 'h1',
  title: 'Book dentist',
  createdBy: 'anna',
  isRepeat: false,
  isPrivate: false,
};

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
    membersOf: vi.fn(() => Promise.resolve(['anna', 'ben', 'carol'])),
    displayNameOf: vi.fn((userId: string) => Promise.resolve(userId === 'anna' ? 'Anna' : null)),
    subscriptionsOf: vi.fn((userIds: string[]) =>
      Promise.resolve(userIds.flatMap((userId) => subscriptions[userId] ?? [])),
    ),
    send: vi.fn(() => Promise.resolve(201)),
    forget: vi.fn(() => Promise.resolve()),
    ...overrides,
  } satisfies NotifyDependencies;
}

describe('notify household', () => {
  it("tells every other member's devices who added which task", async () => {
    const deps = fakeDeps();

    await expect(notifyHousehold('t1', deps)).resolves.toEqual({ sent: 2, removed: 0, failed: 0 });

    expect(deps.subscriptionsOf).toHaveBeenCalledWith(['ben', 'carol']);
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

    await notifyHousehold('t1', deps);

    const [[, message]] = vi.mocked(deps.send).mock.calls as unknown as [
      [DeviceSubscription, unknown],
    ];
    expect(parsePushPayload(message)).toEqual(message);
  });

  it('does nothing for a task that no longer exists', async () => {
    const deps = fakeDeps();

    await expect(notifyHousehold('unknown', deps)).resolves.toEqual({
      sent: 0,
      removed: 0,
      failed: 0,
    });
    expect(deps.membersOf).not.toHaveBeenCalled();
  });

  it("doesn't notify anyone about the next occurrence of a repeating task", async () => {
    const deps = fakeDeps();
    vi.mocked(deps.taskById).mockResolvedValue({ ...task, isRepeat: true });

    await expect(notifyHousehold('t1', deps)).resolves.toEqual({ sent: 0, removed: 0, failed: 0 });
    expect(deps.send).not.toHaveBeenCalled();
  });

  it("doesn't notify anyone about a private task", async () => {
    const deps = fakeDeps();
    vi.mocked(deps.taskById).mockResolvedValue({ ...task, isPrivate: true });

    await expect(notifyHousehold('t1', deps)).resolves.toEqual({ sent: 0, removed: 0, failed: 0 });
    expect(deps.membersOf).not.toHaveBeenCalled();
  });

  it("doesn't notify anyone when the creator is alone in the household", async () => {
    const deps = fakeDeps({ membersOf: () => Promise.resolve(['anna']) });

    await expect(notifyHousehold('t1', deps)).resolves.toEqual({ sent: 0, removed: 0, failed: 0 });
    expect(deps.subscriptionsOf).not.toHaveBeenCalled();
  });

  it('credits "Someone" when the creator has no name or no account any more', async () => {
    const deps = fakeDeps();

    vi.mocked(deps.taskById).mockResolvedValue({ ...task, createdBy: null });

    await notifyHousehold('t1', deps);

    expect(deps.displayNameOf).not.toHaveBeenCalled();
    expect(deps.send).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ body: 'Someone added Book dentist' }),
    );
  });
});

describe('webhook payload', () => {
  const record = { id: 't1', household_id: 'h1', title: 'Book dentist', created_by: 'anna' };

  it('reads only the id of an inserted task', () => {
    expect(parseAddedTaskId({ type: 'INSERT', table: 'tasks', record })).toBe('t1');
  });

  it.each([
    ['nothing', undefined],
    ['an update', { type: 'UPDATE', table: 'tasks', record }],
    ['another table', { type: 'INSERT', table: 'profiles', record }],
    ['no record', { type: 'INSERT', table: 'tasks' }],
    ['a record without an id', { type: 'INSERT', table: 'tasks', record: { title: 'x' } }],
  ])('ignores %s', (_case, payload) => {
    expect(parseAddedTaskId(payload)).toBeNull();
  });
});
