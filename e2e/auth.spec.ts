import { expect, test } from '@playwright/test';

import { fakeSupabase, logInAsNewUser } from './fakeSupabase';

// Requests that pass through the app's service worker can't be intercepted in WebKit, so the
// Supabase fake would be bypassed. The offline behaviour isn't what these tests cover.
test.use({ serviceWorkers: 'block' });

test('user can create an account, stay logged in, log out and log back in', async ({ page }) => {
  await fakeSupabase(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);

  await logInAsNewUser(page);
  await expect(page.getByRole('heading', { name: 'Set up your household' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Set up your household' })).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('heading', { name: 'Log in to HomeFlow' })).toBeVisible();

  await page.getByLabel('Email').fill('anna@example.com');
  await page.getByLabel('Password').fill('a long password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('heading', { name: 'Set up your household' })).toBeVisible();
});
