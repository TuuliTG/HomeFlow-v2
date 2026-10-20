import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  EXISTING_HOUSEHOLD,
  fakeSupabase,
  logInAsFamilyMember,
  logInAsNewUser,
  TINY_PNG,
} from './fakeSupabase';

// See auth.spec.ts: the Supabase fake can't intercept requests that go through the service worker.
test.use({ serviceWorkers: 'block' });

test('family member can create a task and see it on the shared task board', async ({ page }) => {
  await fakeSupabase(page);
  await logInAsFamilyMember(page);
  await page.getByRole('link', { name: 'Shared tasks' }).click();
  await expect(page.getByText('No tasks yet. Create the first one!')).toBeVisible();

  await page.getByRole('link', { name: 'New task' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'New task' })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, 'a11y violations on the new task form').toEqual([]);

  await page.getByLabel('Task', { exact: true }).fill('Water plants');
  await page.getByRole('radio', { name: 'Meta work' }).check();
  await page.getByLabel('Points').fill('5');
  await page.getByRole('checkbox', { name: 'Children can do it' }).check();
  await page.getByRole('button', { name: 'Create task' }).click();

  const task = page.getByRole('listitem', { name: 'Water plants' });
  await expect(task).toBeVisible();
  await expect(task.getByText('5 points')).toBeVisible();
  await expect(task.getByText('For children')).toBeVisible();
  await expect(task.getByText('Added by you')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('listitem', { name: 'Water plants' })).toBeVisible();
});

test('family member can attach a picture to a task and see it on the board', async ({ page }) => {
  await fakeSupabase(page);
  await logInAsFamilyMember(page);
  await page.getByRole('link', { name: 'Shared tasks' }).click();
  await page.getByRole('link', { name: 'New task' }).click();

  await page.getByLabel('Task', { exact: true }).fill('Water plants');
  await page
    .getByLabel('Add a picture')
    .setInputFiles({ name: 'balcony.png', mimeType: 'image/png', buffer: TINY_PNG });
  await expect(page.getByRole('img', { name: 'Picture 1' })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, 'a11y violations on the task form with a picture').toEqual([]);
  await page.getByRole('button', { name: 'Create task' }).click();

  const picture = page
    .getByRole('listitem', { name: 'Water plants' })
    .getByRole('img', { name: 'Picture 1 of Water plants (opens in a new tab)' });
  await expect(picture).toBeVisible();
  await expect
    .poll(() => picture.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBe(1);

  await page.getByRole('link', { name: 'Edit: Water plants' }).click();
  await page.getByRole('button', { name: 'Remove picture 1' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('listitem', { name: 'Water plants' })).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Picture 1 of Water plants (opens in a new tab)' }),
  ).toHaveCount(0);
});

test('family member can add a task again from earlier tasks and favourites', async ({ page }) => {
  await fakeSupabase(page);
  await logInAsFamilyMember(page);
  await page.getByRole('link', { name: 'Shared tasks' }).click();
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
  await page.getByLabel('Task', { exact: true }).fill('Take out trash');
  await page.getByRole('button', { name: 'Favourite' }).click();
  await expect(page.getByRole('button', { name: 'Favourite' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByLabel('Task', { exact: true }).fill('');
  await page
    .getByRole('region', { name: 'Favourites' })
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
  await page.getByRole('link', { name: 'Shared tasks' }).click();

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
  await expect(task.getByText('Last done by you, today')).toBeVisible();
  await expect(page.getByText('Was due Tue 6 Oct')).toBeHidden();
});

test('family member can pick up a task, find it on the Me screen and mark it done there', async ({
  page,
}) => {
  await fakeSupabase(page);
  await logInAsFamilyMember(page);
  await page.getByRole('link', { name: 'Shared tasks' }).click();
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

  await expect(toDo.getByText('Nothing picked up yet.')).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Completed tasks' }).getByText('Vacuum'),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Points earned' })).toContainText('3');
});

test('family member can set a reminder for a task they picked up', async ({ page }) => {
  await fakeSupabase(page);
  await logInAsFamilyMember(page);
  await page.getByRole('link', { name: 'Shared tasks' }).click();
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
  await page.getByRole('link', { name: 'Shared tasks' }).click();
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

test('family member can show the tasks done in the household and star one', async ({ page }) => {
  await fakeSupabase(page);
  await logInAsFamilyMember(page);
  await page.getByRole('link', { name: 'Shared tasks' }).click();
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

  const star = completed.getByRole('button', { name: 'Favourite: Vacuum' });
  await star.click();
  await expect(star).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: 'New task' }).click();
  await expect(
    page.getByRole('region', { name: 'Favourites' }).getByRole('button', { name: /Vacuum/ }),
  ).toBeVisible();
});

test('family member can say who helped with a task and share its points', async ({ page }) => {
  await fakeSupabase(page);
  await logInAsNewUser(page);
  await page.getByLabel('Invite code').fill(EXISTING_HOUSEHOLD.inviteCode);
  await page.getByRole('button', { name: 'Join household' }).click();
  await page.getByRole('link', { name: 'Shared tasks' }).click();
  await page.getByRole('link', { name: 'New task' }).click();
  await page.getByLabel('Task', { exact: true }).fill('Laundry');
  await page.getByRole('button', { name: 'Create task' }).click();
  await page.getByRole('button', { name: 'Mark done: Laundry' }).click();

  // Asked straight away; the Me page offers the same link for a week.
  await expect(page.getByText('Laundry done! Did someone help?')).toBeVisible();
  const board = await new AxeBuilder({ page }).analyze();
  expect(board.violations, 'a11y violations with the prompt').toEqual([]);
  await page.getByRole('link', { name: 'Who helped with Laundry?' }).click();
  await page.getByRole('checkbox', { name: 'Ben helped' }).check();
  await page.getByRole('combobox', { name: 'Points for Ben' }).selectOption('1');
  await expect(page.getByText('You keep 2 points.')).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, 'a11y violations on the helpers page').toEqual([]);
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page).toHaveURL('/me');
  const completed = page.getByRole('list', { name: 'Completed tasks' });
  await expect(completed.getByText('Helped by Ben (1 point)')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Points earned' })).toContainText('2');
});

test('family member can ask another to do a task, and call it off', async ({ page }) => {
  await fakeSupabase(page);
  await logInAsNewUser(page);
  await page.getByLabel('Invite code').fill(EXISTING_HOUSEHOLD.inviteCode);
  await page.getByRole('button', { name: 'Join household' }).click();
  await page.getByRole('link', { name: 'Shared tasks' }).click();
  await page.getByRole('link', { name: 'New task' }).click();
  await page.getByLabel('Task', { exact: true }).fill('Laundry');
  await page.getByRole('button', { name: 'Create task' }).click();

  await page.getByRole('link', { name: 'Ask someone to do Laundry' }).click();
  await page.getByRole('radio', { name: 'Ben' }).check();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, 'a11y violations on the ask page').toEqual([]);
  await page.getByRole('button', { name: 'Send request' }).click();

  await expect(page).toHaveURL('/');
  const task = page.getByRole('listitem', { name: 'Laundry' });
  await expect(task.getByText('You asked Ben to do this.')).toBeVisible();
  const board = await new AxeBuilder({ page }).analyze();
  expect(board.violations, 'a11y violations with the request').toEqual([]);
  await task.getByRole('button', { name: 'Cancel request: Laundry' }).click();
  await expect(task.getByRole('link', { name: 'Ask someone to do Laundry' })).toBeVisible();
});

test('marking a task done celebrates without getting in the way', async ({ page }) => {
  await fakeSupabase(page);
  await logInAsFamilyMember(page);
  await page.getByRole('link', { name: 'Shared tasks' }).click();
  for (const title of ['Vacuum', 'Dishes']) {
    await page.getByRole('link', { name: 'New task' }).click();
    await page.getByLabel('Task', { exact: true }).fill(title);
    await page.getByLabel('Points').fill('3');
    await page.getByRole('button', { name: 'Create task' }).click();
  }

  await page.getByRole('button', { name: 'Mark done: Vacuum' }).click();
  await expect(page.getByText('+3 points')).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, 'a11y violations while celebrating').toEqual([]);
  // The next tap works straight away, through the celebration.
  await page.getByRole('button', { name: 'Mark done: Dishes' }).click();
  await expect(page.getByRole('listitem', { name: 'Dishes' })).toBeHidden();
  await expect(page.getByText('+3 points')).toBeHidden();
});

test('with reduced motion, a done task gets no flying stars', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fakeSupabase(page);
  await logInAsFamilyMember(page);
  await page.getByRole('link', { name: 'Shared tasks' }).click();
  await page.getByRole('link', { name: 'New task' }).click();
  await page.getByLabel('Task', { exact: true }).fill('Vacuum');
  await page.getByLabel('Points').fill('3');
  await page.getByRole('button', { name: 'Create task' }).click();

  await page.getByRole('button', { name: 'Mark done: Vacuum' }).click();

  const points = page.getByText('+3 points');
  await expect(points).toBeVisible();
  await expect(points.locator('xpath=..').locator('svg').first()).toBeHidden();
});
