import type { Page, Route } from '@playwright/test';

import { FAKE_SUPABASE_URL } from '../playwright.config';

function fakeJwt(sub: string) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub, exp, role: 'authenticated' })}.sig`;
}

/** A household someone else already created; join it with this code. */
export const EXISTING_HOUSEHOLD = { name: 'The Virtanens', inviteCode: 'KTXN4P7Q' };
/** The code a household created in a test gets. */
export const NEW_INVITE_CODE = 'ABCD2345';

interface HouseholdRow {
  id: string;
  name: string;
  invite_code: string;
}

async function reply(route: Route, status: number, body?: unknown) {
  await route.fulfill({
    status,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? '' : JSON.stringify(body),
  });
}

/** Answers like PostgREST: one object (or 406) when the client asks for one, otherwise an array. */
async function replyWithRows(route: Route, rows: unknown[]) {
  const wantsObject = (route.request().headers().accept ?? '').includes('vnd.pgrst.object');
  return wantsObject ? reply(route, rows.length ? 200 : 406, rows[0]) : reply(route, 200, rows);
}

/** Ids from a PostgREST filter such as `eq.u1` or `in.(u1,u2)`. */
function filterIds(filter: string | null): string[] {
  if (!filter) return [];
  return filter
    .replace(/^(eq\.|in\.\()/, '')
    .replace(/\)$/, '')
    .split(',');
}

/**
 * Answers the Supabase Auth and REST calls the app makes, so e2e tests run without a backend.
 * Any code is accepted for any email. Like Row Level Security, it shows the user only their own
 * household; another household (Ben's) exists to join with `EXISTING_HOUSEHOLD.inviteCode`.
 */
export async function fakeSupabase(page: Page) {
  const user = {
    id: 'e2e-user',
    email: 'anna@example.com',
    aud: 'authenticated',
    role: 'authenticated',
  };
  const profiles = new Map([['e2e-ben', 'Ben']]);
  const existing: HouseholdRow = {
    id: 'e2e-existing-household',
    name: EXISTING_HOUSEHOLD.name,
    invite_code: EXISTING_HOUSEHOLD.inviteCode,
  };
  const members = new Map([[existing.id, ['e2e-ben']]]);
  let ownHousehold: HouseholdRow | null = null;

  function joinAs(household: HouseholdRow) {
    ownHousehold = household;
    members.set(household.id, [...(members.get(household.id) ?? []), user.id]);
  }

  async function profilesEndpoint(route: Route) {
    const request = route.request();
    if (request.method() === 'POST') {
      const row = request.postDataJSON() as { id: string; display_name: string };
      profiles.set(row.id, row.display_name);
      return reply(route, 201);
    }
    const ids = filterIds(new URL(request.url()).searchParams.get('id'));
    return replyWithRows(
      route,
      ids.flatMap((id) => {
        const name = profiles.get(id);
        return name ? [{ id, display_name: name }] : [];
      }),
    );
  }

  async function createHousehold(route: Route) {
    const { household_name } = route.request().postDataJSON() as { household_name: string };
    const household = { id: 'e2e-household', name: household_name, invite_code: NEW_INVITE_CODE };
    joinAs(household);
    return reply(route, 200, household);
  }

  async function joinHousehold(route: Route) {
    const { invite_code } = route.request().postDataJSON() as { invite_code: string };
    if (invite_code !== existing.invite_code) {
      return reply(route, 400, { code: 'P0002', message: 'No household has this invite code' });
    }
    joinAs(existing);
    return reply(route, 200, existing.id);
  }

  async function membersEndpoint(route: Route) {
    const userIds = ownHousehold ? (members.get(ownHousehold.id) ?? []) : [];
    return reply(
      route,
      200,
      userIds.map((id) => ({ user_id: id })),
    );
  }

  await page.route(`${FAKE_SUPABASE_URL}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname.replace(/^\/fake-supabase/, '');
    switch (pathname) {
      case '/auth/v1/otp':
        return reply(route, 200, {});
      case '/auth/v1/verify':
        return reply(route, 200, {
          access_token: fakeJwt(user.id),
          refresh_token: 'e2e-refresh-token',
          token_type: 'bearer',
          expires_in: 3600,
          user,
        });
      case '/auth/v1/logout':
        return reply(route, 204);
      case '/rest/v1/profiles':
        return profilesEndpoint(route);
      case '/rest/v1/households':
        return replyWithRows(route, ownHousehold ? [ownHousehold] : []);
      case '/rest/v1/household_members':
        return membersEndpoint(route);
      case '/rest/v1/rpc/create_household':
        return createHousehold(route);
      case '/rest/v1/rpc/join_household':
        return joinHousehold(route);
      default:
        return reply(route, 404, { message: `Not faked: ${pathname}` });
    }
  });
}

/** Logs in as Anna from the login page and chooses her display name. */
export async function logInAsNewUser(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('anna@example.com');
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel('Login code').fill('123456');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByLabel('Your name').fill('Anna');
  await page.getByRole('button', { name: 'Save' }).click();
}
