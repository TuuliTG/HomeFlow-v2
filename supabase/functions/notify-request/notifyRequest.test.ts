import { describe, expect, it, vi } from 'vitest';

import { parsePushPayload } from '@/lib/pushNotification';

import type { DeviceSubscription } from '../_shared/push';
import {
  type NotifyRequestDependencies,
  notifyRequest,
  parseRequestChange,
  type TaskRequest,
} from './notifyRequest';

const request: TaskRequest = {
  taskTitle: 'Book dentist',
  requestedBy: 'anna',
  requestedFor: 'ben',
  answer: null,
};

function device(userId: string) {
  return { userId, endpoint: `https://push.example.com/${userId}`, p256dh: 'key', auth: 'secret' };
}

function fakeDeps(overrides: Partial<NotifyRequestDependencies> = {}) {
  const names: Record<string, string> = { anna: 'Anna', ben: 'Ben' };
  return {
    requestById: vi.fn((requestId: string) => Promise.resolve(requestId === 'r1' ? request : null)),
    displayNameOf: vi.fn((userId: string) => Promise.resolve(names[userId] ?? null)),
    subscriptionsOf: vi.fn((userIds: string[]) => Promise.resolve(userIds.map(device))),
    send: vi.fn(() => Promise.resolve(201)),
    forget: vi.fn(() => Promise.resolve()),
    ...overrides,
  } satisfies NotifyRequestDependencies;
}

describe('notify request', () => {
  it('tells the member asked who asks them to do which task, opening their tasks', async () => {
    const deps = fakeDeps();

    await expect(notifyRequest({ requestId: 'r1', kind: 'asked' }, deps)).resolves.toEqual({
      sent: 1,
      removed: 0,
      failed: 0,
    });

    expect(deps.send).toHaveBeenCalledWith(device('ben'), {
      title: 'HomeFlow',
      body: 'Anna asks you to do Book dentist',
      url: '/me',
    });
  });

  it.each([
    ['accepted', 'Ben will do Book dentist'],
    ['declined', "Ben can't do Book dentist"],
  ] as const)('tells whoever asked when the request is %s', async (answer, body) => {
    const deps = fakeDeps();
    vi.mocked(deps.requestById).mockResolvedValue({ ...request, answer });

    await notifyRequest({ requestId: 'r1', kind: 'answered' }, deps);

    expect(deps.send).toHaveBeenCalledWith(device('anna'), { title: 'HomeFlow', body, url: '/' });
  });

  it('sends a message the service worker shows as is', async () => {
    const deps = fakeDeps();
    vi.mocked(deps.requestById).mockResolvedValue({ ...request, taskTitle: 'x'.repeat(80) });
    vi.mocked(deps.displayNameOf).mockResolvedValue('y'.repeat(50));

    await notifyRequest({ requestId: 'r1', kind: 'asked' }, deps);

    const [[, message]] = vi.mocked(deps.send).mock.calls as unknown as [
      [DeviceSubscription, unknown],
    ];
    expect(parsePushPayload(message)).toEqual(message);
  });

  it('says "Someone" when the member has no name', async () => {
    const deps = fakeDeps({ displayNameOf: () => Promise.resolve(null) });

    await notifyRequest({ requestId: 'r1', kind: 'asked' }, deps);

    expect(deps.send).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ body: 'Someone asks you to do Book dentist' }),
    );
  });

  it.each([
    { what: 'a request that no longer exists', kind: 'asked', stored: null },
    {
      what: 'a new request already answered',
      kind: 'asked',
      stored: { ...request, answer: 'accepted' },
    },
    { what: 'an answer to a request still waiting', kind: 'answered', stored: request },
  ] as const)("doesn't notify anyone about $what", async ({ kind, stored }) => {
    const deps = fakeDeps();
    vi.mocked(deps.requestById).mockResolvedValue(stored);

    await expect(notifyRequest({ requestId: 'r1', kind }, deps)).resolves.toEqual({
      sent: 0,
      removed: 0,
      failed: 0,
    });
    expect(deps.send).not.toHaveBeenCalled();
  });
});

describe('webhook payload', () => {
  const record = { id: 'r1', task_id: 't1', requested_by: 'anna', requested_for: 'ben' };

  it('reads a new request', () => {
    expect(parseRequestChange({ type: 'INSERT', table: 'task_requests', record })).toEqual({
      requestId: 'r1',
      kind: 'asked',
    });
  });

  it('reads an answer', () => {
    expect(parseRequestChange({ type: 'UPDATE', table: 'task_requests', record })).toEqual({
      requestId: 'r1',
      kind: 'answered',
    });
  });

  it.each([
    ['nothing', undefined],
    ['a delete', { type: 'DELETE', table: 'task_requests', old_record: record }],
    ['another table', { type: 'INSERT', table: 'tasks', record }],
    ['no record', { type: 'INSERT', table: 'task_requests' }],
    ['a record without an id', { type: 'INSERT', table: 'task_requests', record: { x: 1 } }],
  ])('ignores %s', (_case, payload) => {
    expect(parseRequestChange(payload)).toBeNull();
  });
});
