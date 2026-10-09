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

  await page.getByLabel('Task', { exact: true }).fill('Water plants');
  await page.getByRole('radio', { name: 'Meta work' }).check();
  await page.getByLabel('Points').fill('5');
  await page.getByRole('button', { name: 'Create task' }).click();

  const task = page.getByRole('listitem', { name: 'Water plants' });
  await expect(task).toBeVisible();
  await expect(task.getByText('5 points')).toBeVisible();
  await expect(task.getByText('Added by you')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('listitem', { name: 'Water plants' })).toBeVisible();
});

test('family member can add a task again from earlier tasks', async ({ page }) => {
  await fakeSupabase(page);
  await logInAsFamilyMember(page);
  await page.getByRole('link', { name: 'Tasks' }).click();
  await page.getByRole('link', { name: 'New task' }).click();
  await page.getByLabel('Task', { exact: true }).fill('Take out trash');
  await page.getByLabel('Points').fill('1');
  await page.getByRole('button', { name: 'Create task' }).click();
  const firstTask = page.getByRole('listitem', { name: 'Take out trash' });
  await firstTask.getByRole('button', { name: 'Mark done: Take out trash' }).click();
  await expect(firstTask).toBeHidden();

  await page.getByRole('link', { name: 'New task' }).click();
  await page.getByLabel('Task', { exact: true }).fill('trash');
  await expect(page.getByRole('option', { name: /Take out trash/ })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, 'a11y violations on the task suggestions').toEqual([]);
  await page.getByRole('option', { name: /Take out trash/ }).click();
  await expect(page.getByLabel('Points')).toHaveValue('1');
  await page.getByRole('button', { name: 'Create task' }).click();

  await expect(page.getByRole('listitem', { name: 'Take out trash' })).toBeVisible();
  await page.getByRole('link', { name: 'New task' }).click();
  await page
    .getByRole('region', { name: 'Add again' })
    .getByRole('button', { name: /Take out trash/ })
    .click();
  await expect(
    page.getByText('Take out trash is already on the board.', { exact: false }),
  ).toBeVisible();
});

test('family member can mark a repeating task done and see it come back', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 8, 12));
  await fakeSupabase(page);
  await logInAsFamilyMember(page);
  await page.getByRole('link', { name: 'Tasks' }).click();

  await page.getByRole('link', { name: 'New task' }).click();
  await page.getByLabel('Task', { exact: true }).fill('Change bed linen');
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
  await page.getByLabel('Task', { exact: true }).fill('Vacuum');
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
  await expect(page.getByRole('region', { name: 'Points earned' })).toContainText('3');
});

test('family member can set a reminder for a task they picked up', async ({ page }) => {
  await fakeSupabase(page);
  await logInAsFamilyMember(page);
  await page.getByRole('link', { name: 'Tasks' }).click();
  await page.getByRole('link', { name: 'New task' }).click();
  await page.getByLabel('Task', { exact: true }).fill('Vacuum');
  await page.getByRole('button', { name: 'Create task' }).click();
  await page
    .getByRole('listitem', { name: 'Vacuum' })
    .getByRole('button', { name: 'Pick up: Vacuum' })
    .click();

  await page.getByRole('link', { name: 'Me' }).click();
  const task = page
    .getByRole('region', { name: 'To do' })
    .getByRole('listitem', { name: 'Vacuum' });
  await task.getByRole('button', { name: 'Remind me: Vacuum' }).click();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const pad = (value: number) => String(value).padStart(2, '0');
  await task
    .getByLabel('Remind me at')
    .fill(
      `${String(tomorrow.getFullYear())}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T09:00`,
    );
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, 'a11y violations on the reminder form').toEqual([]);
  await task.getByRole('button', { name: 'Save reminder' }).click();

  await expect(task.getByText('Reminder tomorrow at 9:00')).toBeVisible();
});

test('family member can fix a task and then delete it', async ({ page }) => {
  await fakeSupabase(page);
  await logInAsFamilyMember(page);
  await page.getByRole('link', { name: 'Tasks' }).click();
  await page.getByRole('link', { name: 'New task' }).click();
  await page.getByLabel('Task', { exact: true }).fill('Vacum');
  await page.getByLabel('Description (optional)').fill('Under the sofa too');
  await page.getByRole('button', { name: 'Create task' }).click();
  await expect(page.getByText('Under the sofa too')).toBeVisible();

  await page.getByRole('link', { name: 'Edit: Vacum' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Edit task' })).toBeVisible();
  await page.getByLabel('Task', { exact: true }).fill('Vacuum');
  await page.getByLabel('Points').fill('4');
  await page.getByRole('button', { name: 'Save changes' }).click();

  const task = page.getByRole('listitem', { name: 'Vacuum' });
  await expect(task.getByText('4 points')).toBeVisible();

  await task.getByRole('link', { name: 'Edit: Vacuum' }).click();
  await page.getByRole('button', { name: 'Delete task' }).click();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, 'a11y violations on the edit page').toEqual([]);
  await page.getByRole('button', { name: 'Yes, delete' }).click();

  await expect(page.getByText('No tasks yet. Create the first one!')).toBeVisible();
});

test('family member can show the tasks done in the household', async ({ page }) => {
  await fakeSupabase(page);
  await logInAsFamilyMember(page);
  await page.getByRole('link', { name: 'Tasks' }).click();
  await page.getByRole('link', { name: 'New task' }).click();
  await page.getByLabel('Task', { exact: true }).fill('Vacuum');
  await page.getByRole('button', { name: 'Create task' }).click();
  await page.getByRole('button', { name: 'Mark done: Vacuum' }).click();
  await expect(page.getByText('No tasks yet. Create the first one!')).toBeVisible();

  await page.getByRole('switch', { name: 'Show completed' }).check();

  const completed = page.getByRole('region', { name: 'Completed' });
  await expect(completed.getByText('Vacuum')).toBeVisible();
  await expect(completed.getByText(/^Done by you/)).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, 'a11y violations with completed tasks shown').toEqual([]);
});
