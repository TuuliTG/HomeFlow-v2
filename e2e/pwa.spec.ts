import { expect, test } from '@playwright/test';

test('service worker installs and keeps the app working offline', async ({ page, context }) => {
  await page.goto('/login');
  const activated = await page.evaluate(() =>
    Promise.race([
      navigator.serviceWorker.ready.then(() => true),
      new Promise<boolean>((resolve) => setTimeout(resolve, 10_000, false)),
    ]),
  );
  expect(activated, 'the service worker activates').toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Log in to HomeFlow' })).toBeVisible();
  const servedByWorker = await page.evaluate(() => navigator.serviceWorker.controller !== null);
  expect(servedByWorker, 'the page came from the service worker').toBe(true);
  await page.goto('/statistics');
  await expect(page.getByRole('heading', { level: 1, name: 'Log in to HomeFlow' })).toBeVisible();
});
