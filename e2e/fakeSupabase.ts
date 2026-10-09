import type { Page, Route } from '@playwright/test';

import { FAKE_SUPABASE_URL } from '../playwright.config';

function fakeJwt(sub: string) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub, exp, role: 'authenticated' })}.sig`;
}

/** A household someone else already created; join it with this code. */
export const EXISTING_HOUSEHOLD = {
  name: 'The Virtanens',
  inviteCode: 'KTXN4P7Q',
  task: 'Book dentist',
};
/** The code a household created in a test gets. */
export const NEW_INVITE_CODE = 'ABCD2345';

interface HouseholdRow {
  id: string;
  name: string;
  invite_code: string;
}

interface TaskRow {
  id: string;
  household_id: string;
  title: string;
  description: string | null;
  type: string;
  points: number;
  created_by: string;
  repeat_every_days: number | null;
  due_on: string | null;
  picked_up_by: string | null;
  completed_at: string | null;
  completed_by: string | null;
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
 * Any email and password are accepted. Like Row Level Security, it shows the user only their own
 * household and its tasks; another household (Ben's, with one task) exists to join with
 * `EXISTING_HOUSEHOLD.inviteCode`.
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
  // Newest first; the GET answer then puts the soonest due first, like the app asks for.
  const tasks: TaskRow[] = [
    {
      id: 'e2e-ben-task',
      household_id: existing.id,
      title: EXISTING_HOUSEHOLD.task,
      description: null,
      type: 'planning',
      points: 5,
      created_by: 'e2e-ben',
      repeat_every_days: null,
      due_on: null,
      picked_up_by: null,
      completed_at: null,
      completed_by: null,
    },
  ];

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

  async function tasksEndpoint(route: Route) {
    const request = route.request();
    if (request.method() === 'POST') {
      if (!ownHousehold) return reply(route, 400, { code: '23502', message: 'No household' });
      const task = request.postDataJSON() as Pick<
        TaskRow,
        'title' | 'description' | 'type' | 'points' | 'repeat_every_days' | 'due_on'
      >;
      tasks.unshift({
        ...task,
        id: `e2e-task-${String(tasks.length)}`,
        household_id: ownHousehold.id,
        created_by: user.id,
        picked_up_by: null,
        completed_at: null,
        completed_by: null,
      });
      return reply(route, 201);
    }
    const householdId = ownHousehold?.id;
    // The Me screen asks for the user's completed tasks (`completed_by=eq.<id>`), newest first.
    const completedBy = new URL(request.url()).searchParams.get('completed_by');
    if (completedBy) {
      const done = tasks.filter((task) => `eq.${String(task.completed_by)}` === completedBy);
      return reply(
        route,
        200,
        done.sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at))),
      );
    }
    return reply(
      route,
      200,
      tasks
        .filter((task) => task.household_id === householdId && task.completed_at === null)
        // Stable sort, so tasks with the same due date (or none) stay newest first.
        .sort((a, b) => (a.due_on ?? '9999-12-31').localeCompare(b.due_on ?? '9999-12-31')),
    );
  }

  /** Like complete_task(): marks the task done and adds the next occurrence of a repeating task. */
  async function completeTask(route: Route) {
    const { task_id, completed_on } = route.request().postDataJSON() as {
      task_id: string;
      completed_on: string;
    };
    const task = tasks.find(
      (candidate) =>
        candidate.id === task_id &&
        candidate.household_id === ownHousehold?.id &&
        candidate.completed_at === null,
    );
    if (!task) return reply(route, 400, { code: 'P0002', message: 'No open task with this id' });
    task.completed_at = new Date().toISOString();
    task.completed_by = user.id;
    if (task.repeat_every_days === null) return reply(route, 200, null);
    const due = new Date(`${completed_on}T00:00:00Z`);
    due.setUTCDate(due.getUTCDate() + task.repeat_every_days);
    const next = {
      ...task,
      id: `e2e-task-${String(tasks.length)}`,
      due_on: due.toISOString().slice(0, 10),
      picked_up_by: null,
      completed_at: null,
      completed_by: null,
    };
    tasks.unshift(next);
    return reply(route, 200, next.id);
  }

  /** Like pick_up_task() and put_back_task(): `pickedUpBy` is who has the task afterwards. */
  function setPickedUp(pickedUpBy: string | null) {
    return async (route: Route) => {
      const { task_id } = route.request().postDataJSON() as { task_id: string };
      const task = tasks.find(
        (candidate) => candidate.id === task_id && candidate.household_id === ownHousehold?.id,
      );
      if (!task) return reply(route, 400, { code: 'P0002', message: 'No open task with this id' });
      task.picked_up_by = pickedUpBy;
      return reply(route, 204);
    };
  }

  function ownOpenTask(taskId: string) {
    return tasks.find(
      (task) =>
        task.id === taskId && task.household_id === ownHousehold?.id && task.completed_at === null,
    );
  }

  /** Like update_task(). */
  async function updateTask(route: Route) {
    const body = route.request().postDataJSON() as {
      task_id: string;
      task_title: string;
      task_description: string | null;
      task_type: string;
      task_points: number;
      task_due_on: string | null;
      task_repeat_every_days: number | null;
    };
    const task = ownOpenTask(body.task_id);
    if (!task) return reply(route, 400, { code: 'P0002', message: 'No open task with this id' });
    Object.assign(task, {
      title: body.task_title,
      description: body.task_description,
      type: body.task_type,
      points: body.task_points,
      due_on: body.task_due_on,
      repeat_every_days: body.task_repeat_every_days,
    });
    return reply(route, 204);
  }

  /** Like delete_task(). */
  async function deleteTask(route: Route) {
    const { task_id } = route.request().postDataJSON() as { task_id: string };
    const task = ownOpenTask(task_id);
    if (!task) return reply(route, 400, { code: 'P0002', message: 'No open task with this id' });
    tasks.splice(tasks.indexOf(task), 1);
    return reply(route, 204);
  }

  /** Accepts any email and password, for both creating an account and logging in. */
  function logInWith(route: Route) {
    return reply(route, 200, {
      access_token: fakeJwt(user.id),
      refresh_token: 'e2e-refresh-token',
      token_type: 'bearer',
      expires_in: 3600,
      user,
    });
  }

  const endpoints: Record<string, (route: Route) => Promise<void>> = {
    '/auth/v1/signup': (route) => logInWith(route),
    '/auth/v1/token': (route) => logInWith(route),
    '/auth/v1/logout': (route) => reply(route, 204),
    '/rest/v1/profiles': profilesEndpoint,
    '/rest/v1/households': (route) => replyWithRows(route, ownHousehold ? [ownHousehold] : []),
    '/rest/v1/household_members': membersEndpoint,
    '/rest/v1/rpc/create_household': createHousehold,
    '/rest/v1/rpc/join_household': joinHousehold,
    '/rest/v1/rpc/complete_task': completeTask,
    '/rest/v1/rpc/pick_up_task': setPickedUp(user.id),
    '/rest/v1/rpc/put_back_task': setPickedUp(null),
    '/rest/v1/rpc/update_task': updateTask,
    '/rest/v1/rpc/delete_task': deleteTask,
    '/rest/v1/tasks': tasksEndpoint,
  };

  await page.route(`${FAKE_SUPABASE_URL}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname.replace(/^\/fake-supabase/, '');
    const endpoint = endpoints[pathname];
    return endpoint ? endpoint(route) : reply(route, 404, { message: `Not faked: ${pathname}` });
  });
}

/** Creates an account for Anna from the login page and chooses her display name. */
export async function logInAsNewUser(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Email').fill('anna@example.com');
  await page.getByLabel('Password').fill('a long password');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByLabel('Your name').fill('Anna');
  await page.getByRole('button', { name: 'Save' }).click();
}

/** Logs in as a new user and creates a household, ending on the household page. */
export async function logInAsFamilyMember(page: Page) {
  await logInAsNewUser(page);
  await page.getByLabel('Household name').fill('The Andersons');
  await page.getByRole('button', { name: 'Create household' }).click();
  await page.getByRole('heading', { level: 1, name: 'The Andersons' }).waitFor();
}
