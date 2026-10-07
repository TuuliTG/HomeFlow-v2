import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('user can move between all main screens', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Available tasks' })).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const [link, heading] of [
    ['Me', 'My tasks'],
    ['Rewards', 'Rewards & goals'],
    ['Statistics', 'Fairness & progress'],
    ['Tasks', 'Available tasks'],
  ] as const) {
    await nav.getByRole('link', { name: link }).click();
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
});

test('user can log in with a name and log out (mock, front end only)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Log in' }).click();

  await page.getByLabel('Your name').fill('Anna');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByText('Hello, Anna')).toBeVisible();

  await page.reload();
  await expect(page.getByText('Hello, Anna')).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
});

test('main screens have no detectable accessibility violations', async ({ page }) => {
  for (const path of ['/', '/me', '/rewards', '/statistics', '/login']) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, `a11y violations on ${path}`).toEqual([]);
  }
});

test('app is installable as a PWA', async ({ page }) => {
  await page.goto('/');
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBeTruthy();

  const response = await page.request.get(manifestHref ?? '');
  const manifest = (await response.json()) as { name: string; display: string };
  expect(manifest).toMatchObject({ name: 'HomeFlow', display: 'standalone' });
});
