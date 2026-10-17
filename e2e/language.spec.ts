import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { fakeSupabase, logInAsFamilyMember } from './fakeSupabase';

// See auth.spec.ts: the Supabase fake can't intercept requests that go through the service worker.
test.use({ serviceWorkers: 'block' });

test.describe('in a Finnish browser', () => {
  test.use({ locale: 'fi-FI' });

  test('HomeFlow speaks Finnish from the start', async ({ page }) => {
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Kirjaudu HomeFlow’hun' }),
    ).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fi');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, 'a11y violations on the Finnish login').toEqual([]);
  });
});

test('family member can switch HomeFlow to Finnish, and it stays Finnish', async ({ page }) => {
  await fakeSupabase(page);
  await logInAsFamilyMember(page);

  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('combobox', { name: 'Language of HomeFlow' }).selectOption('Suomi');

  await expect(page.getByRole('heading', { level: 1, name: 'Asetukset' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fi');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, 'a11y violations in Finnish').toEqual([]);

  await page
    .getByRole('navigation', { name: 'Päävalikko' })
    .getByRole('link', { name: 'Yhteiset' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Yhteiset tehtävät' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Yhteiset tehtävät' })).toBeVisible();
});
