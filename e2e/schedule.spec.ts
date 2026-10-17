import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import { fakeSupabase, logInAsFamilyMember } from './fakeSupabase';

// See auth.spec.ts: the Supabase fake can't intercept requests that go through the service worker.
test.use({ serviceWorkers: 'block' });

/** Adds a shared task and picks it up, so it is the user's to do. */
async function pickUpNewTask(page: Page, title: string) {
  await page.getByRole('link', { name: 'Shared tasks' }).click();
  await page.getByRole('link', { name: 'New task' }).click();
  await page.getByLabel('Task', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Create task' }).click();
  await page
    .getByRole('listitem', { name: title })
    .getByRole('button', { name: `Pick up: ${title}` })
    .click();
}

test('family member can plan their tasks in a weekly timetable', async ({ page }) => {
  await fakeSupabase(page);
  await logInAsFamilyMember(page);
  await pickUpNewTask(page, 'Vacuum');

  await page.getByRole('link', { name: 'Me' }).click();
  await page.getByRole('radio', { name: 'Week' }).check({ force: true });
  const notScheduled = page.getByRole('region', { name: 'Not scheduled yet' });
  await notScheduled.getByRole('button', { name: 'Schedule: Vacuum' }).click();
  const form = page.getByRole('form', { name: 'When to do Vacuum' });
  await form.getByLabel('Start').fill('09:00');
  await form.getByLabel('Length').selectOption({ label: '1 h' });
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, 'a11y violations on the timetable and its form').toEqual([]);
  await form.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('button', { name: 'Vacuum, 9:00–10:00' })).toBeVisible();
  await expect(notScheduled.getByText('All your tasks are in the timetable.')).toBeVisible();
  // The week fits a phone's screen without scrolling sideways.
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageWidth).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Vacuum, 9:00–10:00' })).toBeVisible();
});

test('family member can drag a task into the timetable and move it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Touch dragging needs touch and hold, which Playwright cannot do.');
  // Tall enough for the morning hours and the tasks below the timetable to show at once.
  await page.setViewportSize({ width: 1280, height: 1400 });
  await fakeSupabase(page);
  await logInAsFamilyMember(page);
  await pickUpNewTask(page, 'Vacuum');
  await page.goto('/me?view=day');

  const item = page
    .getByRole('region', { name: 'Not scheduled yet' })
    .getByRole('button', { name: 'Schedule: Vacuum' });
  // The column starts at midnight and an hour is 60px tall; the timetable opens at 7:00.
  const column = page.getByRole('list', { name: /^Planned for / }).locator('..');
  const from = await item.boundingBox();
  const day = await column.boundingBox();
  if (!from || !day) throw new Error('Nothing to drag');
  await drag(page, { x: from.x + 10, y: from.y + 10 }, { x: day.x + 20, y: day.y + 9 * 60 });
  const block = page.getByRole('button', { name: 'Vacuum, 9:00–9:30' });
  await expect(block).toBeVisible();

  const box = await block.boundingBox();
  if (!box) throw new Error('The block is not shown');
  await drag(page, { x: box.x + 10, y: box.y + 5 }, { x: box.x + 10, y: box.y + 65 });

  await expect(page.getByRole('button', { name: 'Vacuum, 10:00–10:30' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Vacuum, 10:00–10:30' })).toBeVisible();
});

/** Drags with the mouse from one point on the page to another. */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y + 10, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

test('family member can tap an empty time to add a new task there', async ({ page }) => {
  await fakeSupabase(page);
  await logInAsFamilyMember(page);
  await page.goto('/me?view=day');

  // The timetable opens at 7:00, and an hour is 60px tall: 10:00 is 180px down, below its 6:50 top.
  const timetable = page.getByRole('region', { name: 'Timetable' });
  await timetable.evaluate((element) => {
    element.scrollIntoView({ block: 'start' });
  });
  const box = await timetable.boundingBox();
  if (!box) throw new Error('The timetable is not shown');
  await page.mouse.click(box.x + box.width / 2, box.y + 190 + 5);
  await expect(page.getByRole('heading', { name: / at 10:00$/ })).toBeFocused();
  await page.getByRole('link', { name: 'Add a new task' }).click();

  await expect(page.getByText(/^It goes in your timetable on .* at 10:00\./)).toBeVisible();
  await page.getByLabel('Task', { exact: true }).fill('Mow the lawn');
  await page.getByRole('button', { name: 'Create task' }).click();

  await expect(page).toHaveURL(/\/me\?view=day$/);
  await expect(page.getByRole('button', { name: 'Mow the lawn, 10:00–10:30' })).toBeVisible();
});
