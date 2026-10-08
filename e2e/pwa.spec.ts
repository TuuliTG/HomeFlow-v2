import { expect, test } from '@playwright/test';

// Offline support rests on two facts checked here: the service worker controls the page, and the
// app shell is in its precache. (Reloading under Playwright's offline mode isn't reliable in WebKit.)
test('service worker controls the app and precaches its shell for offline use', async ({
  page,
}) => {
  await page.goto('/login');
  const activated = await page.evaluate(() =>
    Promise.race([
      navigator.serviceWorker.ready.then(() => true),
      new Promise<boolean>((resolve) => setTimeout(resolve, 10_000, false)),
    ]),
  );
  expect(activated, 'the service worker activates').toBe(true);

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Log in to HomeFlow' })).toBeVisible();
  const controlled = await page.evaluate(() => navigator.serviceWorker.controller !== null);
  expect(controlled, 'the service worker controls the page').toBe(true);

  const shellCached = await page.evaluate(async () => {
    const cached = await caches.match('/index.html', { ignoreSearch: true });
    return cached !== undefined;
  });
  expect(shellCached, 'the app shell is precached').toBe(true);
});
