import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';

// Unit tests never reach Supabase: the auth api is replaced by an in-memory fake.
vi.mock('@/features/auth/api', () => import('@/test/fakeAuthApi'));

afterEach(() => {
  cleanup();
  localStorage.clear();
  fakeAuthBackend.reset();
});
