import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { fakeSupabase, logInAsFamilyMember } from './fakeSupabase';

// See auth.spec.ts: the Supabase fake can't intercept requests that go through the service worker.
test.use({ serviceWorkers: 'block' });

test('family member can create a task and see it on the shared task board', async ({ page }) => {
  await fakeSupabase(page);
  await logInAsFamilyMember(page);
  await page.getByRole('link', { name: 'Tasks' }).click();
  await expect(page.getByText('No tasks yet. Create the first one!')).toBeVisible();

  await page.getByRole('link', { name: 'New task' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'New task' })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, 'a11y violations on the new task form').toEqual([]);

  await page.getByLabel('Task').fill('Water plants');
  await page.getByRole('radio', { name: 'Planning' }).check();
  await page.getByLabel('Points').fill('5');
  await page.getByRole('button', { name: 'Create task' }).click();

  const task = page.getByRole('listitem', { name: 'Water plants' });
  await expect(task).toBeVisible();
  await expect(task.getByText('5 points')).toBeVisible();
  await expect(task.getByText('Added by you')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('listitem', { name: 'Water plants' })).toBeVisible();
});
