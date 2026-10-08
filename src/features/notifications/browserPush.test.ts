import { describe, expect, it, vi } from 'vitest';

import type * as browserPush from '@/features/notifications/browserPush';

// Only the notification settings tests mock this module, so the real one is imported here.
const push = await vi.importActual<typeof browserPush>('@/features/notifications/browserPush');

const json = { endpoint: 'https://push.example.com/a', keys: { p256dh: 'key', auth: 'secret' } };

function fakeBrowser({ permission = 'granted', subscribed = true, installed = true } = {}) {
  const subscription = {
    endpoint: json.endpoint,
    toJSON: () => json,
    unsubscribe: vi.fn(() => Promise.resolve(true)),
  };
  const pushManager = {
    getSubscription: vi.fn(() => Promise.resolve(subscribed ? subscription : null)),
    subscribe: vi.fn(() => Promise.resolve(subscription)),
  };
  vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0 (Linux; Android 14)',
    maxTouchPoints: 5,
    serviceWorker: {
      getRegistration: () => Promise.resolve(installed ? { pushManager } : undefined),
    },
  });
  vi.stubGlobal('PushManager', {});
  vi.stubGlobal('Notification', {
    permission,
    requestPermission: vi.fn(() => Promise.resolve(permission)),
  });
  return { subscription, pushManager };
}

describe('browser push', () => {
  it('is supported where service workers, push and notifications exist', () => {
    fakeBrowser();

    expect(push.pushSupport()).toBe('supported');
    expect(push.permission()).toBe('granted');
  });

  it.each([
    ['an iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5],
    ['an iPad', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5],
  ])('asks %s to add HomeFlow to the Home Screen first', (_device, userAgent, maxTouchPoints) => {
    vi.stubGlobal('navigator', { userAgent, maxTouchPoints });

    expect(push.pushSupport()).toBe('needs-home-screen');
  });

  it('is unsupported elsewhere without the Push API', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (X11; Linux)', maxTouchPoints: 0 });

    expect(push.pushSupport()).toBe('unsupported');
  });

  it('subscribes with the VAPID key after the user allows notifications', async () => {
    const { pushManager } = fakeBrowser();

    await expect(push.subscribeDevice(`B${'_-'.repeat(43)}`)).resolves.toEqual({
      endpoint: json.endpoint,
      p256dh: 'key',
      auth: 'secret',
    });
    const [[options]] = pushManager.subscribe.mock.calls as unknown as [
      [{ userVisibleOnly: boolean; applicationServerKey: Uint8Array }],
    ];
    expect(options.userVisibleOnly).toBe(true);
    expect(options.applicationServerKey).toHaveLength(65);
  });

  it("doesn't subscribe when the user says no", async () => {
    const { pushManager } = fakeBrowser({ permission: 'denied' });

    await expect(push.subscribeDevice(`B${'a'.repeat(86)}`)).resolves.toBeNull();
    expect(pushManager.subscribe).not.toHaveBeenCalled();
  });

  it("reads and removes this device's subscription", async () => {
    const { subscription } = fakeBrowser();

    await expect(push.getDeviceSubscription()).resolves.toMatchObject({ endpoint: json.endpoint });
    await expect(push.unsubscribeDevice()).resolves.toBe(json.endpoint);
    expect(subscription.unsubscribe).toHaveBeenCalled();
  });

  it('reports no subscription when notifications are off', async () => {
    fakeBrowser({ subscribed: false });

    await expect(push.getDeviceSubscription()).resolves.toBeNull();
    await expect(push.unsubscribeDevice()).resolves.toBeNull();
  });

  it('rejects an incomplete subscription from the browser', async () => {
    const { subscription } = fakeBrowser();
    subscription.toJSON = () => ({ endpoint: json.endpoint, keys: { p256dh: '', auth: '' } });

    await expect(push.getDeviceSubscription()).rejects.toThrow('incomplete push subscription');
  });

  it('reports no subscription without waiting when no service worker is installed', async () => {
    fakeBrowser({ installed: false });

    await expect(push.getDeviceSubscription()).resolves.toBeNull();
    await expect(push.unsubscribeDevice()).resolves.toBeNull();
  });

  it("can't subscribe before the service worker is installed", async () => {
    fakeBrowser({ installed: false });

    await expect(push.subscribeDevice(`B${'a'.repeat(86)}`)).rejects.toThrow('no service worker');
  });
});
