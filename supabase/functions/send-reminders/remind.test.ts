import { describe, expect, it, vi } from 'vitest';

import { parsePushPayload } from '@/lib/pushNotification';

import type { DeviceSubscription } from '../_shared/push';
import { type RemindDependencies, sendDueReminders } from './remind';

function device(userId: string) {
  return { userId, endpoint: `https://push.example.com/${userId}`, p256dh: 'key', auth: 'secret' };
}

function fakeDeps(overrides: Partial<RemindDependencies> = {}) {
  return {
    takeDueReminders: vi.fn(() =>
      Promise.resolve([
        { userId: 'anna', taskTitle: 'Book dentist' },
        { userId: 'ben', taskTitle: 'Vacuum' },
      ]),
    ),
    subscriptionsOf: vi.fn((userIds: string[]) => Promise.resolve(userIds.map(device))),
    send: vi.fn(() => Promise.resolve(201)),
    forget: vi.fn(() => Promise.resolve()),
    ...overrides,
  } satisfies RemindDependencies;
}

describe('send due reminders', () => {
  it('reminds each user of their own task on their own devices, opening My tasks', async () => {
    const deps = fakeDeps();

    await expect(sendDueReminders(deps)).resolves.toEqual({ sent: 2, removed: 0, failed: 0 });

    expect(deps.send).toHaveBeenCalledWith(device('anna'), {
      title: 'Reminder',
      body: 'Book dentist',
      url: '/me',
    });
    expect(deps.send).toHaveBeenCalledWith(device('ben'), {
      title: 'Reminder',
      body: 'Vacuum',
      url: '/me',
    });
  });

  it('sends a message the service worker shows as is', async () => {
    const deps = fakeDeps({
      takeDueReminders: () => Promise.resolve([{ userId: 'anna', taskTitle: 'x'.repeat(80) }]),
    });

    await sendDueReminders(deps);

    const [[, message]] = vi.mocked(deps.send).mock.calls as unknown as [
      [DeviceSubscription, unknown],
    ];
    expect(parsePushPayload(message)).toEqual(message);
  });

  it('does nothing when no reminder is due', async () => {
    const deps = fakeDeps({ takeDueReminders: () => Promise.resolve([]) });

    await expect(sendDueReminders(deps)).resolves.toEqual({ sent: 0, removed: 0, failed: 0 });
    expect(deps.subscriptionsOf).not.toHaveBeenCalled();
  });

  it('adds up the outcomes over every reminder', async () => {
    const deps = fakeDeps({
      send: vi.fn((subscription: DeviceSubscription) =>
        Promise.resolve(subscription.userId === 'anna' ? 410 : 500),
      ),
    });

    await expect(sendDueReminders(deps)).resolves.toEqual({ sent: 0, removed: 1, failed: 1 });
  });

  it('still sends the other reminders when one fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const deps = fakeDeps({
      subscriptionsOf: vi.fn((userIds: string[]) =>
        userIds.includes('anna')
          ? Promise.reject(new Error('permission denied'))
          : Promise.resolve(userIds.map(device)),
      ),
    });

    await expect(sendDueReminders(deps)).resolves.toEqual({ sent: 1, removed: 0, failed: 1 });
    expect(deps.send).toHaveBeenCalledWith(device('ben'), expect.anything());
  });
});
