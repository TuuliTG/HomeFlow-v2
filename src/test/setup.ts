import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeNewsBackend } from '@/test/fakeNewsApi';
import { fakeTasksBackend } from '@/test/fakeTasksBackend';

// Unit tests never reach Supabase: the feature apis are replaced by in-memory fakes.
vi.mock('@/features/auth/api', () => import('@/test/fakeAuthApi'));
vi.mock('@/features/household/api', () => import('@/test/fakeHouseholdApi'));
vi.mock('@/features/news/api', () => import('@/test/fakeNewsApi'));
vi.mock('@/features/statistics/api', () => import('@/test/fakeStatisticsApi'));
vi.mock('@/features/tasks/api', () => import('@/test/fakeTasksApi'));
vi.mock('@/features/tasks/favouritesApi', () => import('@/test/fakeFavouritesApi'));
vi.mock('@/features/tasks/remindersApi', () => import('@/test/fakeRemindersApi'));

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
  fakeNewsBackend.reset();
});
