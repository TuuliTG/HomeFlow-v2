import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { fakeSupabase, logInAsFamilyMember } from './fakeSupabase';

// See auth.spec.ts: the Supabase fake can't intercept requests that go through the service worker.
test.use({ serviceWorkers: 'block' });

test('visitors are asked to log in', async ({ page }) => {
  await page.goto('/statistics');
  await expect(page.getByRole('heading', { level: 1, name: 'Log in to HomeFlow' })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, 'a11y violations on /login').toEqual([]);
});

test('family member can move between all main screens', async ({ page }) => {
  await fakeSupabase(page);
  await logInAsFamilyMember(page);

  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const [link, heading] of [
    ['Shared tasks', 'Shared tasks'],
    ['Me', 'My tasks'],
    ['Rewards', 'Rewards & goals'],
    ['Statistics', 'Fairness & progress'],
  ] as const) {
    await nav.getByRole('link', { name: link }).click();
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, `a11y violations on ${heading}`).toEqual([]);
  }
});

test('app is installable as a PWA', async ({ page }) => {
  await page.goto('/login');
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBeTruthy();

  const response = await page.request.get(manifestHref ?? '');
  const manifest = (await response.json()) as { name: string; display: string };
  expect(manifest).toMatchObject({ name: 'HomeFlow', display: 'standalone' });
});
