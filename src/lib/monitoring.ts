// Error reporting to Sentry (ADR 0002). The SDK is loaded only when a DSN is set, so builds without one, local
// development and tests send nothing and don't download it.
import { readSentryDsn } from '@/lib/env';
import type * as SentryModule from '@/lib/sentry';

type Sentry = typeof SentryModule;

/**
 * Nothing about who the user is or what they sent: this is family data, and a stack trace is enough to fix a bug.
 * Supabase request URLs carry ids and filters in their query strings.
 */
const privateDataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
} satisfies NonNullable<Parameters<Sentry['init']>[0]>['dataCollection'];

let sentry: Promise<Sentry> | null = null;

/** Starts reporting uncaught errors and unhandled rejections, once, if `VITE_SENTRY_DSN` is set. */
export function startMonitoring(env: Record<string, unknown>): Promise<void> {
  const dsn = readSentryDsn(env);
  if (dsn && !sentry) {
    sentry = import('@/lib/sentry').then((module) => {
      module.init({
        dsn,
        // Vercel sets VITE_VERCEL_ENV (production, preview); local builds use Vite's mode.
        environment: String(env.VITE_VERCEL_ENV ?? env.MODE),
        dataCollection: privateDataCollection,
      });
      return module;
    });
  }
  return sentry?.then(() => undefined) ?? Promise.resolve();
}

/** Reports an error the app caught itself, such as a crashed screen. A no-op while monitoring is off. */
export async function reportError(error: unknown): Promise<void> {
  (await sentry)?.captureException(error);
}
