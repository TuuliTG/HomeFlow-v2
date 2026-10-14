// The real ReportError (../monitoring.ts) for the Edge Functions' index.ts files. Type-checked with `deno check`.
import * as Sentry from 'npm:@sentry/deno@11.7.0';

import type { ReportError } from '../monitoring.ts';

/** How long a failing function waits for its report to reach Sentry before answering. */
const FLUSH_TIMEOUT_MS = 2_000;

const dsn = Deno.env.get('SENTRY_DSN');

if (dsn) {
  Sentry.init({
    dsn,
    // Supabase runs functions in shared isolates, where the default integrations misreport; we report explicitly.
    defaultIntegrations: false,
    // Supabase sets SB_REGION; the hosted project is production.
    environment: Deno.env.get('SB_REGION') ? 'production' : 'development',
    dataCollection: { userInfo: false },
  });
}

/** Logs the failure, as Supabase's function logs show, and reports it to Sentry when SENTRY_DSN is set. */
export const reportError: ReportError = async (message, error, details) => {
  console.error(message, details ?? '', error);
  if (!dsn) return;
  Sentry.captureException(error, { tags: { failure: message }, extra: details });
  await Sentry.flush(FLUSH_TIMEOUT_MS);
};
