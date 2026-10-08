import { z } from 'zod';

// Copying .env.example without filling it in is an easy mistake; fail on its placeholders by name.
const isNotPlaceholder = (value: string) => !value.includes('your-');

const envSchema = z.object({
  VITE_SUPABASE_URL: z.url().refine(isNotPlaceholder),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).refine(isNotPlaceholder),
});

export type Env = z.infer<typeof envSchema>;

// VAPID public keys are uncompressed P-256 points: 65 bytes, 87 characters in base64url.
const vapidPublicKeySchema = z.string().regex(/^[A-Za-z0-9_-]{87}$/);

/**
 * The public VAPID key push subscriptions are made with (ADR 0014), or null when push
 * notifications aren't set up for this deployment. Unlike the Supabase variables it is optional.
 */
export function readVapidPublicKey(source: Record<string, unknown>): string | null {
  const parsed = vapidPublicKeySchema.safeParse(source.VITE_VAPID_PUBLIC_KEY);
  return parsed.success ? parsed.data : null;
}

/**
 * Validates environment variables so misconfiguration fails fast with a clear message
 * instead of surfacing later as an obscure network error.
 */
export function parseEnv(source: Record<string, unknown>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid or missing environment variables: ${fields}. See .env.example.`);
  }
  return result.data;
}
