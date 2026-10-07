import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';

// Unit tests never reach Supabase: the feature apis are replaced by in-memory fakes.
vi.mock('@/features/auth/api', () => import('@/test/fakeAuthApi'));
vi.mock('@/features/household/api', () => import('@/test/fakeHouseholdApi'));

afterEach(() => {
  cleanup();
  localStorage.clear();
  fakeAuthBackend.reset();
  fakeHouseholdBackend.reset();
});
