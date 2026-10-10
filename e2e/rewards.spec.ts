import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { EXISTING_HOUSEHOLD, fakeSupabase, logInAsNewUser } from './fakeSupabase';

// See auth.spec.ts: the Supabase fake can't intercept requests that go through the service worker.
test.use({ serviceWorkers: 'block' });

test("family member sets family goals, with a minimum from each member, and a personal one, follows others' goals, earns the points and claims the reward", async ({
  page,
}) => {
  await fakeSupabase(page);
  await logInAsNewUser(page);
  await page.getByLabel('Invite code').fill(EXISTING_HOUSEHOLD.inviteCode);
  await page.getByRole('button', { name: 'Join household' }).click();
  const nav = page.getByRole('navigation', { name: 'Main' });
  await nav.getByRole('link', { name: 'Rewards' }).click();

  await page.getByRole('link', { name: 'New goal' }).click();
  await page.getByLabel('Reward').fill('Pizza night');
  await page.getByLabel('Points needed').fill('5');
  const newGoalResults = await new AxeBuilder({ page }).analyze();
  expect(newGoalResults.violations, 'a11y violations on New goal').toEqual([]);
  await page.getByRole('button', { name: 'Set goal' }).click();

  await page.getByRole('link', { name: 'New goal' }).click();
  await page.getByLabel('Reward').fill('Zoo trip');
  await page.getByLabel('Points needed').fill('5');
  await page.getByLabel(/Minimum points from each member/).fill('1');
  await page.getByRole('button', { name: 'Set goal' }).click();

  await page.getByRole('link', { name: 'New goal' }).click();
  await page.getByLabel('Reward').fill('New book');
  await page.getByLabel('Points needed').fill('20');
  await page.getByRole('group', { name: "Who it's for" }).getByText('Just me').click();
  await page.getByRole('button', { name: 'Set goal' }).click();

  const familyGoals = page.getByRole('region', { name: 'Family goals' });
  const pizza = familyGoals.getByRole('listitem', { name: 'Pizza night' });
  await expect(pizza).toContainText('0 / 5 points');
  const book = page.getByRole('region', { name: 'Your goals' }).getByRole('listitem', {
    name: 'New book',
  });
  await expect(book).toContainText('0 / 20 points');
  const bens = page
    .getByRole('region', { name: "Family members' goals" })
    .getByRole('listitem', { name: EXISTING_HOUSEHOLD.goal });
  await expect(bens).toContainText("Ben's goal");
  await expect(bens).toContainText('0 / 10 points');
  await expect(bens.getByRole('button')).toHaveCount(0);

  await nav.getByRole('link', { name: 'Shared tasks' }).click();
  const task = page.getByRole('listitem', { name: EXISTING_HOUSEHOLD.task });
  await task.getByRole('button', { name: `Mark done: ${EXISTING_HOUSEHOLD.task}` }).click();
  await expect(task).toBeHidden();
  await nav.getByRole('link', { name: 'Rewards' }).click();

  await expect(pizza).toContainText('Goal reached!');
  // Ben hasn't done his share of the zoo trip yet.
  const zoo = familyGoals.getByRole('listitem', { name: 'Zoo trip' });
  await expect(zoo).toContainText('Enough points! One member still needs to earn their share.');
  await expect(zoo).toContainText('Ben0 / 1');
  await expect(zoo.getByRole('button', { name: /Claim reward/ })).toHaveCount(0);
  await expect(book).toContainText('5 / 20 points');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, 'a11y violations on Rewards').toEqual([]);

  await pizza.getByRole('button', { name: 'Claim reward: Pizza night' }).click();
  await expect(page.getByRole('region', { name: 'Rewards claimed' })).toContainText('Pizza night');
  await expect(pizza).toBeHidden();
});
