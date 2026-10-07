import { z } from 'zod';

// Copying .env.example without filling it in is an easy mistake; fail on its placeholders by name.
const isNotPlaceholder = (value: string) => !value.includes('your-');

const envSchema = z.object({
  VITE_SUPABASE_URL: z.url().refine(isNotPlaceholder),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).refine(isNotPlaceholder),
});

export type Env = z.infer<typeof envSchema>;

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
