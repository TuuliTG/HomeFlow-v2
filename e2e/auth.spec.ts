import { expect, test } from '@playwright/test';

import { fakeSupabase } from './fakeSupabase';

// Requests that pass through the app's service worker can't be intercepted in WebKit, so the
// Supabase fake would be bypassed. The offline behaviour isn't what these tests cover.
test.use({ serviceWorkers: 'block' });

test('user can log in with an emailed code, choose a name and log out', async ({ page }) => {
  await fakeSupabase(page);
  await page.goto('/');
  await page.getByRole('link', { name: 'Log in' }).click();

  await page.getByLabel('Email').fill('anna@example.com');
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel('Login code').fill('123456');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByLabel('Your name').fill('Anna');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Hello, Anna')).toBeVisible();

  await page.reload();
  await expect(page.getByText('Hello, Anna')).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
});
