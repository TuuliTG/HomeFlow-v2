import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('user can create a task and see it on the task board (in memory)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'New task' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'New task' })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, 'a11y violations on the new task form').toEqual([]);

  await page.getByLabel('Task').fill('Book dentist');
  await page.getByRole('radio', { name: 'Planning' }).check();
  await page.getByLabel('Points').fill('5');
  await page.getByRole('button', { name: 'Create task' }).click();

  const task = page.getByRole('listitem', { name: 'Book dentist' });
  await expect(task).toBeVisible();
  await expect(task.getByText('5 points')).toBeVisible();
});
