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
    ['News', 'What the family has done'],
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

test('the tab bar stays at the bottom while the content scrolls', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Wider screens show a side rail instead of a tab bar.');
  // A short screen, so that the content is taller than it.
  await page.setViewportSize({ width: 390, height: 400 });
  await fakeSupabase(page);
  await logInAsFamilyMember(page);
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Statistics' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Fairness & progress' })).toBeVisible();

  await page.getByRole('main').evaluate((main) => main.lastElementChild?.scrollIntoView());

  // Only the content scrolls, never the page: iOS can leave a scrolled page's fixed elements floating mid-screen.
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  const nav = await page.getByRole('navigation', { name: 'Main' }).boundingBox();
  expect((nav?.y ?? 0) + (nav?.height ?? 0)).toBe(400);
});
