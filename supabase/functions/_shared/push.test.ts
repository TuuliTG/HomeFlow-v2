import { describe, expect, it, vi } from 'vitest';

import { type DeviceSubscription, isAuthorized, type PushDependencies, pushToUsers } from './push';

const message = { title: 'HomeFlow', body: 'Anna added Book dentist', url: '/' };

function device(userId: string, endpoint = `https://push.example.com/${userId}`) {
  return { userId, endpoint, p256dh: 'key', auth: 'secret' };
}

function fakeDeps(overrides: Partial<PushDependencies> = {}) {
  return {
    subscriptionsOf: vi.fn(() =>
      Promise.resolve([
        device('ben', 'https://push.example.com/ben-phone'),
        device('ben', 'https://push.example.com/ben-tablet'),
      ]),
    ),
    send: vi.fn(() => Promise.resolve(201)),
    forget: vi.fn(() => Promise.resolve()),
    ...overrides,
  } satisfies PushDependencies;
}

describe('push to users', () => {
  it("sends the message to each of the users' devices", async () => {
    const deps = fakeDeps();

    await expect(pushToUsers(['ben', 'carol'], message, deps)).resolves.toEqual({
      sent: 2,
      removed: 0,
      failed: 0,
    });
    expect(deps.subscriptionsOf).toHaveBeenCalledWith(['ben', 'carol']);
    expect(deps.send).toHaveBeenCalledWith(
      device('ben', 'https://push.example.com/ben-tablet'),
      message,
    );
  });

  it('does nothing for no users', async () => {
    const deps = fakeDeps();

    await expect(pushToUsers([], message, deps)).resolves.toEqual({
      sent: 0,
      removed: 0,
      failed: 0,
    });
    expect(deps.subscriptionsOf).not.toHaveBeenCalled();
  });

  it('forgets devices the push service reports as gone', async () => {
    const deps = fakeDeps({
      send: vi.fn((subscription: DeviceSubscription) =>
        Promise.resolve(subscription.endpoint.endsWith('phone') ? 410 : 404),
      ),
    });

    await expect(pushToUsers(['ben'], message, deps)).resolves.toEqual({
      sent: 0,
      removed: 2,
      failed: 0,
    });
    expect(deps.forget).toHaveBeenCalledWith('https://push.example.com/ben-phone');
    expect(deps.forget).toHaveBeenCalledWith('https://push.example.com/ben-tablet');
  });

  it('counts a gone device it could not forget as failed, and still reports the rest', async () => {
    const deps = fakeDeps({
      send: vi.fn((subscription: DeviceSubscription) =>
        Promise.resolve(subscription.endpoint.endsWith('phone') ? 410 : 201),
      ),
      forget: () => Promise.reject(new Error('database unavailable')),
    });

    await expect(pushToUsers(['ben'], message, deps)).resolves.toEqual({
      sent: 1,
      removed: 0,
      failed: 1,
    });
  });

  it('keeps going when one device fails for another reason', async () => {
    const deps = fakeDeps({
      send: vi
        .fn<PushDependencies['send']>()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce(500)
        .mockResolvedValue(201),
      subscriptionsOf: () => Promise.resolve([device('ben'), device('carol'), device('dave')]),
    });

    await expect(pushToUsers(['ben', 'carol', 'dave'], message, deps)).resolves.toEqual({
      sent: 1,
      removed: 0,
      failed: 2,
    });
    expect(deps.forget).not.toHaveBeenCalled();
  });
});

describe('shared secret', () => {
  it('accepts the configured secret', () => {
    expect(isAuthorized('s3cret-value', 's3cret-value')).toBe(true);
  });

  it.each([
    ['a wrong secret', 's3cret-valuX', 's3cret-value'],
    ['a shorter secret', 's3cret', 's3cret-value'],
    ['no header', null, 's3cret-value'],
    ['no configured secret', 's3cret-value', undefined],
    ['an empty configured secret', '', ''],
  ])('rejects %s', (_case, provided, secret) => {
    expect(isAuthorized(provided, secret)).toBe(false);
  });
});
