import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { EXISTING_HOUSEHOLD, fakeSupabase, logInAsNewUser } from './fakeSupabase';

// See auth.spec.ts: the Supabase fake can't intercept requests that go through the service worker.
test.use({ serviceWorkers: 'block' });

test('family member sees points earned, physical and meta work apart, and tasks created, and how fairly each is shared', async ({
  page,
}) => {
  await fakeSupabase(page);
  await logInAsNewUser(page);
  await page.getByLabel('Invite code').fill(EXISTING_HOUSEHOLD.inviteCode);
  await page.getByRole('button', { name: 'Join household' }).click();
  const nav = page.getByRole('navigation', { name: 'Main' });
  await nav.getByRole('link', { name: 'Shared tasks' }).click();

  const task = page.getByRole('listitem', { name: EXISTING_HOUSEHOLD.task });
  await task.getByRole('button', { name: `Mark done: ${EXISTING_HOUSEHOLD.task}` }).click();
  await expect(task).toBeHidden();
  await nav.getByRole('link', { name: 'Statistics' }).click();

  const points = page.getByRole('region', { name: 'Points earned' });
  await expect(points.getByRole('listitem')).toHaveText([
    'You5 points · 1 task done',
    'Ben0 points · 0 tasks done',
  ]);
  await expect(points).toContainText('Uneven');
  const created = page.getByRole('region', { name: 'Tasks created' });
  await expect(created.getByRole('listitem')).toHaveText(['Ben1 task', 'You0 tasks']);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, 'a11y violations on Statistics').toEqual([]);

  // Book dentist is meta work, so it counts there and not as physical work.
  const workType = page.getByRole('group', { name: 'Work type' });
  await workType.getByText('Physical').click();
  await expect(points.getByRole('listitem')).toHaveText([
    'Ben0 points · 0 tasks done',
    'You0 points · 0 tasks done',
  ]);
  await workType.getByText('Meta work').click();
  await expect(points.getByRole('listitem').first()).toHaveText('You5 points · 1 task done');
  await expect(page).toHaveURL(/work=meta/);

  await page.getByText('All time').click();
  await expect(page).toHaveURL(/period=all/);
  await expect(page.getByRole('radio', { name: 'All time' })).toBeChecked();
});
