import { describe, expect, it, vi } from 'vitest';

import { parsePushPayload } from '@/lib/pushNotification';

import {
  type NotifyPraiseDependencies,
  notifyPraise,
  parsePraise,
  type PraisedTask,
  type TaskComment,
} from './notifyPraise';

const task: PraisedTask = {
  householdId: 'home',
  title: 'Dishes',
  completedBy: 'ben',
  helpers: ['cleo'],
  isPrivate: false,
};

const comment: TaskComment = { taskId: 't1', authorId: 'anna', body: 'Thank you!' };

function device(userId: string) {
  return { userId, endpoint: `https://push.example.com/${userId}`, p256dh: 'key', auth: 'secret' };
}

function fakeDeps(overrides: Partial<NotifyPraiseDependencies> = {}) {
  const names: Record<string, string> = { anna: 'Anna', ben: 'Ben', cleo: 'Cleo' };
  return {
    taskById: vi.fn((taskId: string) => Promise.resolve(taskId === 't1' ? task : null)),
    likeExists: vi.fn(() => Promise.resolve(true)),
    commentById: vi.fn((id: string) => Promise.resolve(id === 'c1' ? comment : null)),
    commentersOn: vi.fn(() => Promise.resolve<string[]>([])),
    membersOf: vi.fn(() =>
      Promise.resolve([
        { userId: 'anna', isChild: false },
        { userId: 'ben', isChild: false },
        { userId: 'cleo', isChild: false },
        { userId: 'dan', isChild: false },
      ]),
    ),
    displayNameOf: vi.fn((userId: string) => Promise.resolve(names[userId] ?? null)),
    usersWanting: vi.fn((userIds: string[]) => Promise.resolve(userIds)),
    subscriptionsOf: vi.fn((userIds: string[]) => Promise.resolve(userIds.map(device))),
    send: vi.fn(() => Promise.resolve(201)),
    forget: vi.fn(() => Promise.resolve()),
    ...overrides,
  } satisfies NotifyPraiseDependencies;
}

function notifiedUsers(deps: ReturnType<typeof fakeDeps>) {
  return vi.mocked(deps.subscriptionsOf).mock.calls.flatMap(([userIds]) => userIds);
}

const like = { kind: 'liked', taskId: 't1', likedBy: 'anna' } as const;
const commented = { kind: 'commented', commentId: 'c1' } as const;

describe('parse praise', () => {
  it('reads a new thumbs up', () => {
    expect(
      parsePraise({
        type: 'INSERT',
        table: 'task_likes',
        record: { task_id: 't1', user_id: 'anna', created_at: '2026-11-04T10:00:00Z' },
      }),
    ).toEqual(like);
  });

  it('reads a new comment by its id only', () => {
    expect(
      parsePraise({
        type: 'INSERT',
        table: 'task_comments',
        record: { id: 'c1', task_id: 't1', author_id: 'anna', body: 'Thank you!' },
      }),
    ).toEqual(commented);
  });

  it.each([
    null,
    'text',
    { type: 'DELETE', table: 'task_likes', record: null, old_record: { task_id: 't1' } },
    { type: 'UPDATE', table: 'task_comments', record: { id: 'c1' } },
    { type: 'INSERT', table: 'tasks', record: { id: 't1' } },
    { type: 'INSERT', table: 'task_likes', record: { task_id: 't1' } },
    { type: 'INSERT', table: 'task_comments', record: { id: 7 } },
  ])('ignores anything else: %j', (payload) => {
    expect(parsePraise(payload)).toBeNull();
  });
});

describe('notify praise', () => {
  it('tells whoever did the task, and its helpers, who gave a thumbs up, opening News', async () => {
    const deps = fakeDeps();

    await expect(notifyPraise(like, deps)).resolves.toEqual({ sent: 2, removed: 0, failed: 0 });

    expect(notifiedUsers(deps)).toEqual(['ben', 'cleo']);
    expect(deps.send).toHaveBeenCalledWith(device('ben'), {
      title: 'HomeFlow',
      body: 'Anna gave you a thumbs up for Dishes',
      url: '/news',
    });
  });

  it('sends nothing for a thumbs up taken back before the webhook arrived', async () => {
    const deps = fakeDeps({ likeExists: vi.fn(() => Promise.resolve(false)) });

    await expect(notifyPraise(like, deps)).resolves.toEqual({ sent: 0, removed: 0, failed: 0 });
    expect(deps.send).not.toHaveBeenCalled();
  });

  it('never tells the member who gave the thumbs up, even when they helped', async () => {
    const deps = fakeDeps({
      taskById: vi.fn(() => Promise.resolve({ ...task, helpers: ['anna', 'cleo'] })),
    });

    await notifyPraise(like, deps);

    expect(notifiedUsers(deps)).toEqual(['ben', 'cleo']);
  });

  it('tells the doer, helpers and earlier commenters about a comment, with what it says', async () => {
    const deps = fakeDeps({ commentersOn: vi.fn(() => Promise.resolve(['anna', 'dan', 'ben'])) });

    await notifyPraise(commented, deps);

    expect(deps.commentersOn).toHaveBeenCalledWith('t1');
    expect(notifiedUsers(deps)).toEqual(['ben', 'cleo', 'dan']);
    expect(deps.send).toHaveBeenCalledWith(device('dan'), {
      title: 'HomeFlow',
      body: 'Anna commented on Dishes: Thank you!',
      url: '/news',
    });
  });

  it('tells the others when the doer replies to a comment', async () => {
    const deps = fakeDeps({
      commentById: vi.fn(() => Promise.resolve({ ...comment, authorId: 'ben' })),
      commentersOn: vi.fn(() => Promise.resolve(['anna', 'ben'])),
    });

    await notifyPraise(commented, deps);

    expect(notifiedUsers(deps)).toEqual(['cleo', 'anna']);
  });

  it('sends nothing for a comment deleted before the webhook arrived', async () => {
    const deps = fakeDeps({ commentById: vi.fn(() => Promise.resolve(null)) });

    await notifyPraise(commented, deps);

    expect(deps.taskById).not.toHaveBeenCalled();
    expect(deps.send).not.toHaveBeenCalled();
  });

  it('shortens a long comment so the push message stays valid', async () => {
    const deps = fakeDeps({
      commentById: vi.fn(() => Promise.resolve({ ...comment, body: '🎉'.repeat(500) })),
    });

    await notifyPraise(commented, deps);

    const message = vi.mocked(deps.send).mock.calls.at(0)?.[1];
    expect(message?.body).toMatch(/^Anna commented on Dishes: (🎉)+…$/u);
    expect(parsePushPayload(message)).toEqual(message);
  });

  it('calls a member whose account is gone "Someone"', async () => {
    const deps = fakeDeps({ displayNameOf: vi.fn(() => Promise.resolve(null)) });

    await notifyPraise(like, deps);

    expect(deps.send).toHaveBeenCalledWith(device('ben'), {
      title: 'HomeFlow',
      body: 'Someone gave you a thumbs up for Dishes',
      url: '/news',
    });
  });

  it('tells neither children, who have no News, nor anyone who left the household', async () => {
    const deps = fakeDeps({
      membersOf: vi.fn(() =>
        Promise.resolve([
          { userId: 'anna', isChild: false },
          { userId: 'cleo', isChild: true },
        ]),
      ),
    });

    await expect(notifyPraise(like, deps)).resolves.toEqual({ sent: 0, removed: 0, failed: 0 });
    expect(deps.send).not.toHaveBeenCalled();
  });

  it.each([
    ['gone', null],
    ['private', { ...task, isPrivate: true }],
    ['no longer done', { ...task, completedBy: null }],
  ])('sends nothing when the task is %s', async (_, found) => {
    const deps = fakeDeps({ taskById: vi.fn(() => Promise.resolve(found)) });

    await notifyPraise(like, deps);

    expect(deps.membersOf).not.toHaveBeenCalled();
    expect(deps.send).not.toHaveBeenCalled();
  });

  it.each([
    [like, 'task_liked'],
    [commented, 'task_commented'],
  ] as const)('respects members who turned %j off', async (praise, kind) => {
    const deps = fakeDeps({ usersWanting: vi.fn(() => Promise.resolve(['cleo'])) });

    await notifyPraise(praise, deps);

    expect(deps.usersWanting).toHaveBeenCalledWith(['ben', 'cleo'], kind);
    expect(notifiedUsers(deps)).toEqual(['cleo']);
  });
});
