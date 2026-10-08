import { expect, test } from '@playwright/test';

test('service worker installs and keeps the app working offline', async ({ page, context }) => {
  await page.goto('/login');
  const hasActiveWorker = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active !== null;
  });
  expect(hasActiveWorker).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Log in to HomeFlow' })).toBeVisible();
  await page.goto('/statistics');
  await expect(page.getByRole('heading', { level: 1, name: 'Log in to HomeFlow' })).toBeVisible();
});
