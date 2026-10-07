import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import { EXISTING_HOUSEHOLD, fakeSupabase, logInAsNewUser, NEW_INVITE_CODE } from './fakeSupabase';

// See auth.spec.ts: the Supabase fake can't intercept requests that go through the service worker.
test.use({ serviceWorkers: 'block' });

async function expectNoA11yViolations(page: Page, screen: string) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, `a11y violations on ${screen}`).toEqual([]);
}

function memberList(page: Page) {
  return page.getByRole('region', { name: 'Members' }).getByRole('listitem');
}

test('new user can create a household and see its invite code', async ({ page }) => {
  await fakeSupabase(page);
  await logInAsNewUser(page);
  await expect(page.getByRole('heading', { name: 'Set up your household' })).toBeVisible();
  await expectNoA11yViolations(page, 'household setup');

  await page.getByLabel('Household name').fill('The Andersons');
  await page.getByRole('button', { name: 'Create household' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'The Andersons' })).toBeVisible();
  await expect(page.getByText(NEW_INVITE_CODE)).toBeVisible();
  await expect(memberList(page)).toHaveText(['Anna (you)']);
  await expectNoA11yViolations(page, 'household');

  await page.getByRole('link', { name: 'Tasks' }).click();
  await expect(page.getByRole('heading', { name: 'Available tasks' })).toBeVisible();
  await expect(page.getByText('Hello, Anna')).toBeVisible();
});

test('new user can join a household with its invite code', async ({ page }) => {
  await fakeSupabase(page);
  await logInAsNewUser(page);

  await page.getByLabel('Invite code').fill('ABCD-ABCD');
  await page.getByRole('button', { name: 'Join household' }).click();
  await expect(page.getByRole('alert')).toHaveText(/No household has this invite code/);

  await page.getByLabel('Invite code').fill(EXISTING_HOUSEHOLD.inviteCode.toLowerCase());
  await page.getByRole('button', { name: 'Join household' }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: EXISTING_HOUSEHOLD.name }),
  ).toBeVisible();
  await expect(memberList(page)).toHaveText(['Ben', 'Anna (you)']);

  await page.reload();
  await expect(page.getByRole('link', { name: EXISTING_HOUSEHOLD.name })).toBeVisible();
});
