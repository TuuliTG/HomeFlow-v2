import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { EXISTING_HOUSEHOLD, fakeSupabase, logInAsNewUser } from './fakeSupabase';

// See auth.spec.ts: the Supabase fake can't intercept requests that go through the service worker.
test.use({ serviceWorkers: 'block' });

test('family member sees done tasks in the news and comments on them', async ({ page }) => {
  await fakeSupabase(page);
  await logInAsNewUser(page);
  await page.getByLabel('Invite code').fill(EXISTING_HOUSEHOLD.inviteCode);
  await page.getByRole('button', { name: 'Join household' }).click();
  const nav = page.getByRole('navigation', { name: 'Main' });
  await nav.getByRole('link', { name: 'News' }).click();
  await expect(page.getByText(/No shared tasks done in the last week yet/)).toBeVisible();

  await nav.getByRole('link', { name: 'Shared tasks' }).click();
  const task = page.getByRole('listitem', { name: EXISTING_HOUSEHOLD.task });
  await task.getByRole('button', { name: `Mark done: ${EXISTING_HOUSEHOLD.task}` }).click();
  await expect(task).toBeHidden();
  await nav.getByRole('link', { name: 'News' }).click();

  const today = page.getByRole('region', { name: 'Today' });
  await expect(today.getByRole('list', { name: 'Points earned' })).toHaveText(
    'You earned 5 points of meta work',
  );
  const news = today.getByRole('listitem', { name: `You completed ${EXISTING_HOUSEHOLD.task}` });
  await expect(news).toContainText('5 points · Meta work');

  await news.getByRole('button', { name: `Comment on ${EXISTING_HOUSEHOLD.task}` }).click();
  await news
    .getByRole('textbox', { name: `Comment on ${EXISTING_HOUSEHOLD.task}` })
    .fill('Booked for Tuesday');
  await news.getByRole('button', { name: 'Send' }).click();
  await expect(news.getByRole('list', { name: 'Comments' })).toContainText(
    'You Booked for Tuesday',
  );

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, 'a11y violations on News').toEqual([]);
});
