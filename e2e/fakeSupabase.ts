import type { Page, Route } from '@playwright/test';

import { FAKE_SUPABASE_URL } from '../playwright.config';

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
};

function fakeJwt(sub: string) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub, exp, role: 'authenticated' })}.sig`;
}

/**
 * Answers the Supabase Auth and REST calls the app makes, so e2e tests run without a backend.
 * Any code is accepted for any email.
 */
export async function fakeSupabase(page: Page) {
  const profiles = new Map<string, string>();
  const user = {
    id: 'e2e-user',
    email: 'anna@example.com',
    aud: 'authenticated',
    role: 'authenticated',
  };

  async function reply(route: Route, status: number, body?: unknown) {
    await route.fulfill({
      status,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
      body: body === undefined ? '' : JSON.stringify(body),
    });
  }

  async function profilesEndpoint(route: Route) {
    const request = route.request();
    if (request.method() === 'POST') {
      const row = request.postDataJSON() as { id: string; display_name: string };
      profiles.set(row.id, row.display_name);
      return reply(route, 201);
    }
    const name = profiles.get(user.id);
    const rows = name ? [{ display_name: name }] : [];
    const wantsObject = (request.headers().accept ?? '').includes('vnd.pgrst.object');
    return wantsObject ? reply(route, rows.length ? 200 : 406, rows[0]) : reply(route, 200, rows);
  }

  await page.route(`${FAKE_SUPABASE_URL}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (route.request().method() === 'OPTIONS') return reply(route, 204);
    if (pathname === '/auth/v1/otp') return reply(route, 200, {});
    if (pathname === '/auth/v1/verify') {
      return reply(route, 200, {
        access_token: fakeJwt(user.id),
        refresh_token: 'e2e-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        user,
      });
    }
    if (pathname === '/auth/v1/logout') return reply(route, 204);
    if (pathname === '/rest/v1/profiles') return profilesEndpoint(route);
    return reply(route, 404, { message: `Not faked: ${pathname}` });
  });
}
