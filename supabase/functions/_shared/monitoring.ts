/**
 * Logs a failure and reports it to Sentry when SENTRY_DSN is set (ADR 0002). The pure halves of the Edge Functions
 * take it as a dependency; `deno/monitoring.ts` is the real one.
 */
export type ReportError = (
  message: string,
  error: unknown,
  details?: Record<string, string>,
) => Promise<void>;
