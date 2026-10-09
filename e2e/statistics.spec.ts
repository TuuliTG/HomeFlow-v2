import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { EXISTING_HOUSEHOLD, fakeSupabase, logInAsNewUser } from './fakeSupabase';

// See auth.spec.ts: the Supabase fake can't intercept requests that go through the service worker.
test.use({ serviceWorkers: 'block' });

test('family member sees who did and added tasks, and how fairly it is shared', async ({
  page,
}) => {
  await fakeSupabase(page);
  await logInAsNewUser(page);
  await page.getByLabel('Invite code').fill(EXISTING_HOUSEHOLD.inviteCode);
  await page.getByRole('button', { name: 'Join household' }).click();
  const nav = page.getByRole('navigation', { name: 'Main' });
  await nav.getByRole('link', { name: 'Tasks' }).click();

  const task = page.getByRole('listitem', { name: EXISTING_HOUSEHOLD.task });
  await task.getByRole('button', { name: `Mark done: ${EXISTING_HOUSEHOLD.task}` }).click();
  await expect(task).toBeHidden();
  await nav.getByRole('link', { name: 'Statistics' }).click();

  const leaderboard = page.getByRole('region', { name: 'Leaderboard' });
  await expect(leaderboard.getByRole('listitem', { name: 'Ben' })).toContainText(
    '0 done · 1 added',
  );
  await expect(leaderboard.getByRole('listitem', { name: 'You' })).toContainText(
    '1 done · 0 added',
  );
  await expect(page.getByRole('region', { name: 'Fairness score' })).toContainText('100');
  await expect(page.getByRole('region', { name: 'Fairness score' })).toContainText('Balanced');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, 'a11y violations on Statistics').toEqual([]);

  await page.getByText('All time').click();
  await expect(page).toHaveURL(/period=all/);
  await expect(page.getByRole('radio', { name: 'All time' })).toBeChecked();
});
