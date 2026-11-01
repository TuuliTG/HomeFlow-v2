import { beforeEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({ init: vi.fn(), captureException: vi.fn() }));
vi.mock('@sentry/react', () => sentry);

const dsn = 'https://abc123@o42.ingest.de.sentry.io/7';

// The module remembers whether it started, so each test gets a fresh copy.
async function loadMonitoring() {
  vi.resetModules();
  return import('@/lib/monitoring');
}

describe('monitoring', () => {
  beforeEach(() => {
    sentry.init.mockClear();
    sentry.captureException.mockClear();
  });

  it('starts Sentry without personal data, named after the Vercel environment', async () => {
    const { startMonitoring } = await loadMonitoring();

    await startMonitoring({ VITE_SENTRY_DSN: dsn, VITE_VERCEL_ENV: 'preview', MODE: 'production' });

    expect(sentry.init).toHaveBeenCalledWith({
      dsn,
      environment: 'preview',
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
      },
    });
  });

  it('falls back to the build mode as the environment outside Vercel', async () => {
    const { startMonitoring } = await loadMonitoring();

    await startMonitoring({ VITE_SENTRY_DSN: dsn, MODE: 'development' });

    expect(sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ environment: 'development' }),
    );
  });

  it('reports errors once started', async () => {
    const { reportError, startMonitoring } = await loadMonitoring();
    const error = new Error('boom');

    await startMonitoring({ VITE_SENTRY_DSN: dsn, MODE: 'production' });
    await reportError(error);

    expect(sentry.captureException).toHaveBeenCalledWith(error);
  });

  it('starts only once', async () => {
    const { startMonitoring } = await loadMonitoring();

    await startMonitoring({ VITE_SENTRY_DSN: dsn, MODE: 'production' });
    await startMonitoring({ VITE_SENTRY_DSN: dsn, MODE: 'production' });

    expect(sentry.init).toHaveBeenCalledOnce();
  });

  it('does nothing without a DSN, so local development and tests send nothing', async () => {
    const { reportError, startMonitoring } = await loadMonitoring();

    await startMonitoring({ MODE: 'development' });
    await reportError(new Error('boom'));

    expect(sentry.init).not.toHaveBeenCalled();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });
});
