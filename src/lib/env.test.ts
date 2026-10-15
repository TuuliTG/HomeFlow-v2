import { describe, expect, it } from 'vitest';

import { parseEnv, readSentryDsn, readVapidPublicKey } from '@/lib/env';

describe('parseEnv', () => {
  it('returns the validated variables', () => {
    const env = parseEnv({
      VITE_SUPABASE_URL: 'https://abc.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'key',
    });

    expect(env.VITE_SUPABASE_URL).toBe('https://abc.supabase.co');
  });

  it('names every invalid or missing variable in the error', () => {
    expect(() => parseEnv({ VITE_SUPABASE_URL: 'not-a-url' })).toThrow(
      /VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY/,
    );
  });

  it('rejects the placeholder values from .env.example', () => {
    expect(() =>
      parseEnv({
        VITE_SUPABASE_URL: 'https://your-project-ref.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'your-anon-key',
      }),
    ).toThrow(/VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY/);
  });
});

describe('readVapidPublicKey', () => {
  const key = `B${'a'.repeat(86)}`;

  it('returns a well-formed public key', () => {
    expect(readVapidPublicKey({ VITE_VAPID_PUBLIC_KEY: key })).toBe(key);
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['too short', 'abc'],
    ['not base64url', `${key.slice(0, 86)}=`],
  ])('treats a %s key as push notifications not being set up', (_case, value) => {
    expect(readVapidPublicKey({ VITE_VAPID_PUBLIC_KEY: value })).toBeNull();
  });
});

describe('readSentryDsn', () => {
  const dsn = 'https://abc123@o42.ingest.de.sentry.io/7';

  it('returns a Sentry DSN', () => {
    expect(readSentryDsn({ VITE_SENTRY_DSN: dsn })).toBe(dsn);
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['not a URL', 'not-a-dsn'],
    ['not https', 'http://abc123@o42.ingest.de.sentry.io/7'],
  ])('treats a %s DSN as error reporting being off', (_case, value) => {
    expect(readSentryDsn({ VITE_SENTRY_DSN: value })).toBeNull();
  });
});
