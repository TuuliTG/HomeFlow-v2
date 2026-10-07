import { describe, expect, it } from 'vitest';

import { parseEnv } from '@/lib/env';

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
