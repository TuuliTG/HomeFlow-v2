import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend } from '@/test/fakeTasksApi';

// Unit tests never reach Supabase: the feature apis are replaced by in-memory fakes.
vi.mock('@/features/auth/api', () => import('@/test/fakeAuthApi'));
vi.mock('@/features/household/api', () => import('@/test/fakeHouseholdApi'));
vi.mock('@/features/tasks/api', () => import('@/test/fakeTasksApi'));

// jsdom has no matchMedia; behave like a browser tab where no media query matches.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({ matches: false, media: query }),
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  fakeAuthBackend.reset();
  fakeHouseholdBackend.reset();
  fakeTasksBackend.reset();
});
