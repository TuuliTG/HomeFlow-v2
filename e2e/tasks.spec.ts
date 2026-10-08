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

test('family member can mark a repeating task done and see it come back', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 8, 12));
  await fakeSupabase(page);
  await logInAsFamilyMember(page);
  await page.getByRole('link', { name: 'Tasks' }).click();

  await page.getByRole('link', { name: 'New task' }).click();
  await page.getByLabel('Task').fill('Change bed linen');
  await page.getByLabel('Repeats').selectOption({ label: 'Every 2 weeks' });
  await page.getByLabel('Due date').fill('2026-10-06');
  await page.getByRole('button', { name: 'Create task' }).click();

  const task = page.getByRole('listitem', { name: 'Change bed linen' });
  await expect(task.getByText('Every 2 weeks')).toBeVisible();
  await expect(task.getByText('Was due Tue 6 Oct')).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, 'a11y violations on the task board').toEqual([]);

  await task.getByRole('button', { name: 'Mark done: Change bed linen' }).click();

  await expect(task.getByText('Due Thu 22 Oct')).toBeVisible();
  await expect(page.getByText('Was due Tue 6 Oct')).toBeHidden();
});

test('family member can pick up a task, find it on the Me screen and mark it done there', async ({
  page,
}) => {
  await fakeSupabase(page);
  await logInAsFamilyMember(page);
  await page.getByRole('link', { name: 'Tasks' }).click();
  await page.getByRole('link', { name: 'New task' }).click();
  await page.getByLabel('Task').fill('Vacuum');
  await page.getByRole('button', { name: 'Create task' }).click();

  const task = page.getByRole('listitem', { name: 'Vacuum' });
  await task.getByRole('button', { name: 'Pick up: Vacuum' }).click();
  await expect(task.getByText('Picked up by you')).toBeVisible();

  await page.getByRole('link', { name: 'Me' }).click();
  const toDo = page.getByRole('region', { name: 'To do' });
  await expect(toDo.getByRole('listitem', { name: 'Vacuum' })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, 'a11y violations on the Me screen').toEqual([]);

  await toDo.getByRole('button', { name: 'Mark done: Vacuum' }).click();

  await expect(toDo.getByText('Nothing picked up yet. Pick a task on the board.')).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Completed tasks' }).getByText('Vacuum'),
  ).toBeVisible();
});
