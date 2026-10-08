import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as browserPush from '@/features/notifications/browserPush';

// Only the notification settings tests mock this module, so the real one is imported here.
const push = await vi.importActual<typeof browserPush>('@/features/notifications/browserPush');

const KEY = `B${'_-'.repeat(43)}`;
const OTHER_KEY = `B${'a'.repeat(86)}`;
const json = { endpoint: 'https://push.example.com/a', keys: { p256dh: 'key', auth: 'secret' } };

function keyBytes(base64Url: string) {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64.padEnd(88, '=')), (char) => char.charCodeAt(0)).buffer;
}

function fakeBrowser({ permission = 'granted', subscribed = true, installed = true } = {}) {
  const subscription = {
    endpoint: json.endpoint,
    options: { applicationServerKey: keyBytes(KEY) as ArrayBuffer | null },
    toJSON: () => json,
    unsubscribe: vi.fn(() => Promise.resolve(true)),
  };
  const pushManager = {
    getSubscription: vi.fn(() => Promise.resolve(subscribed ? subscription : null)),
    subscribe: vi.fn(() => Promise.resolve(subscription)),
  };
  const registration = { pushManager };
  vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0 (Linux; Android 14)',
    maxTouchPoints: 5,
    serviceWorker: {
      ready: installed ? Promise.resolve(registration) : new Promise(() => undefined),
      getRegistration: () => Promise.resolve(installed ? registration : undefined),
    },
  });
  vi.stubGlobal('PushManager', {});
  vi.stubGlobal('Notification', {
    permission,
    requestPermission: vi.fn(() => Promise.resolve(permission)),
  });
  return { subscription, pushManager };
}

function fakeIos(userAgent: string, { homeScreen = false } = {}) {
  vi.stubGlobal('navigator', { userAgent, maxTouchPoints: 5 });
  vi.stubGlobal('matchMedia', () => ({ matches: homeScreen }));
}

describe('browser push support', () => {
  it('is supported where service workers, push and notifications exist', () => {
    fakeBrowser();

    expect(push.pushSupport()).toBe('supported');
    expect(push.permission()).toBe('granted');
  });

  it.each([
    ['an iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'],
    ['an iPad', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'],
  ])('asks %s in Safari to add HomeFlow to the Home Screen first', (_device, userAgent) => {
    fakeIos(userAgent);

    expect(push.pushSupport()).toBe('needs-home-screen');
  });

  it('calls an iPhone too old for push unsupported even on the Home Screen', () => {
    fakeIos('Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)', { homeScreen: true });

    expect(push.pushSupport()).toBe('unsupported');
  });

  it('is unsupported elsewhere without the Push API', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (X11; Linux)', maxTouchPoints: 0 });

    expect(push.pushSupport()).toBe('unsupported');
  });
});

describe('browser push subscriptions', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks the user for permission', async () => {
    fakeBrowser({ permission: 'denied' });

    await expect(push.requestPermission()).resolves.toBe('denied');
  });

  it('subscribes with the decoded VAPID key, for visible notifications only', async () => {
    const { pushManager } = fakeBrowser();

    await expect(push.subscribeDevice(KEY)).resolves.toEqual({
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

  it('gives up subscribing when no service worker becomes active', async () => {
    vi.useFakeTimers();
    fakeBrowser({ installed: false });

    const subscribing = push.subscribeDevice(KEY);
    const failed = expect(subscribing).rejects.toThrow('no service worker');
    await vi.advanceTimersByTimeAsync(10_000);
    await failed;
  });

  it("reads this device's subscription made with the current key", async () => {
    fakeBrowser();

    await expect(push.getDeviceSubscription(KEY)).resolves.toMatchObject({
      endpoint: json.endpoint,
    });
    await expect(push.getDeviceEndpoint()).resolves.toBe(json.endpoint);
  });

  it('drops a subscription made with another key', async () => {
    const { subscription } = fakeBrowser();

    await expect(push.getDeviceSubscription(OTHER_KEY)).resolves.toBeNull();
    expect(subscription.unsubscribe).toHaveBeenCalled();
  });

  it('drops a subscription without a key', async () => {
    const { subscription } = fakeBrowser();
    subscription.options.applicationServerKey = null;

    await expect(push.getDeviceSubscription(KEY)).resolves.toBeNull();
  });

  it('unsubscribes this device', async () => {
    const { subscription } = fakeBrowser();

    await push.unsubscribeDevice();

    expect(subscription.unsubscribe).toHaveBeenCalled();
  });

  it.each([
    ['notifications are off', { subscribed: false }],
    ['no service worker is installed', { installed: false }],
  ])('reports no subscription without waiting when %s', async (_case, options) => {
    fakeBrowser(options);

    await expect(push.getDeviceSubscription(KEY)).resolves.toBeNull();
    await expect(push.getDeviceEndpoint()).resolves.toBeNull();
    await expect(push.unsubscribeDevice()).resolves.toBeUndefined();
  });

  it('rejects an incomplete subscription from the browser', async () => {
    const { subscription } = fakeBrowser();
    subscription.toJSON = () => ({ endpoint: json.endpoint, keys: { p256dh: '', auth: '' } });

    await expect(push.getDeviceSubscription(KEY)).rejects.toThrow('incomplete push subscription');
  });
});
