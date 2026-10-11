/**
 * Answers for the Edge Functions the app calls from the browser (ADR 0003). Free of Deno so it can be
 * unit-tested with Vitest.
 */

/** What a function answers: an HTTP status and a JSON body. */
export interface JsonAnswer {
  status: number;
  body: unknown;
}

/**
 * The browser calls the functions from the app's own origin with an Authorization header, so it asks
 * first (CORS preflight). They take no cookies, so any origin may ask; the tokens decide what happens.
 */
export const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

export function failure(status: number, error: string): JsonAnswer {
  return { status, body: { error } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** A string field of a JSON request body, or null when it is missing or not a string. */
export function stringField(body: unknown, name: string): string | null {
  if (!isRecord(body)) return null;
  const value = body[name];
  return typeof value === 'string' ? value : null;
}
