import { describe, expect, it, vi } from 'vitest';

import { notificationPath, openApp, parsePushPayload } from '@/lib/pushNotification';

const generic = {
  title: 'HomeFlow',
  body: 'There is something new in your household.',
  url: '/',
};

describe('push notifications', () => {
  it('shows who added which task, and opens the given page', () => {
    expect(
      parsePushPayload({ title: 'HomeFlow', body: 'Ben added Book dentist', url: '/me' }),
    ).toEqual({ title: 'HomeFlow', body: 'Ben added Book dentist', url: '/me' });
  });

  it('opens the task board when no page is given', () => {
    expect(parsePushPayload({ title: 'HomeFlow', body: 'Ben added Dust' }).url).toBe('/');
  });

  it.each([
    ['nothing', undefined],
    ['not an object', 'Ben added Dust'],
    ['no title', { body: 'Ben added Dust' }],
    ['an empty title', { title: '', body: 'x' }],
    ['a body that is not text', { title: 'HomeFlow', body: 42 }],
    ['a far too long body', { title: 'HomeFlow', body: 'x'.repeat(301) }],
  ])('shows a generic notification for %s', (_case, json) => {
    expect(parsePushPayload(json)).toEqual(generic);
  });

  it.each([
    ['another site', 'https://evil.example/'],
    ['a protocol-relative URL', '//evil.example/'],
    ['a backslash trick', '/\\evil.example/'],
    ['a tab trick', '/\t/evil.example/'],
    ['a newline trick', '/\n/evil.example/'],
    ['a carriage-return trick', '/\r\\evil.example'],
    ['a relative path', 'me'],
    ['not text', 42],
  ])('never opens %s', (_case, url) => {
    expect(parsePushPayload({ title: 'HomeFlow', body: 'x', url }).url).toBe('/');
    expect(notificationPath(url)).toBe('/');
  });

  it('opens the page a shown notification points to', () => {
    expect(notificationPath('/household')).toBe('/household');
  });
});

function fakeWindow(url: string, focused = false) {
  return {
    url,
    focused,
    focus: vi.fn(() => Promise.resolve()),
    navigate: vi.fn(() => Promise.resolve()),
  };
}

function fakeClients(windows: ReturnType<typeof fakeWindow>[]) {
  return {
    matchAll: vi.fn(() => Promise.resolve(windows)),
    openWindow: vi.fn(() => Promise.resolve()),
  };
}

const board = 'https://homeflow.example/';

describe('tapping a notification', () => {
  it('opens HomeFlow when no window is open', async () => {
    const clients = fakeClients([]);

    await openApp(clients, board);

    expect(clients.openWindow).toHaveBeenCalledWith(board);
  });

  it('brings the focused HomeFlow window forward and shows the page there', async () => {
    const other = fakeWindow('https://homeflow.example/me');
    const focused = fakeWindow('https://homeflow.example/rewards', true);
    const clients = fakeClients([other, focused]);

    await openApp(clients, board);

    expect(focused.focus).toHaveBeenCalled();
    expect(focused.navigate).toHaveBeenCalledWith(board);
    expect(other.focus).not.toHaveBeenCalled();
    expect(clients.openWindow).not.toHaveBeenCalled();
  });

  it("doesn't reload a window that already shows the page", async () => {
    const window = fakeWindow(board);

    await openApp(fakeClients([window]), board);

    expect(window.focus).toHaveBeenCalled();
    expect(window.navigate).not.toHaveBeenCalled();
  });

  it("opens a new window when the open one can't be navigated", async () => {
    const uncontrolled = fakeWindow('https://homeflow.example/me');
    uncontrolled.navigate.mockRejectedValue(new TypeError('Not controlled'));
    const clients = fakeClients([uncontrolled]);

    await openApp(clients, board);

    expect(clients.openWindow).toHaveBeenCalledWith(board);
  });
});
