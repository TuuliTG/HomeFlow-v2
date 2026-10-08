import { describe, expect, it } from 'vitest';

import { findAppWindow, notificationPath, parsePushPayload } from '@/lib/pushNotification';

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
    ['a relative path', 'me'],
    ['not text', 42],
  ])('never opens %s', (_case, url) => {
    expect(parsePushPayload({ title: 'HomeFlow', body: 'x', url }).url).toBe('/');
    expect(notificationPath(url)).toBe('/');
  });

  it('opens the page a shown notification points to', () => {
    expect(notificationPath('/household')).toBe('/household');
  });

  it('reuses an open HomeFlow window and ignores other sites', () => {
    const other = { url: 'https://example.com/' };
    const app = { url: 'https://homeflow.example/me' };

    expect(findAppWindow([other, app], 'https://homeflow.example')).toBe(app);
    expect(findAppWindow([other], 'https://homeflow.example')).toBeUndefined();
  });
});
