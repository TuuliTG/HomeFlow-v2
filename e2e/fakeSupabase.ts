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
  points: number | null;
  created_by: string;
  repeat_every_days: number | null;
  due_on: string | null;
  picked_up_by: string | null;
  is_private: boolean;
  created_at: string;
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
      type: 'meta',
      points: 5,
      created_by: 'e2e-ben',
      repeat_every_days: null,
      due_on: null,
      picked_up_by: null,
      is_private: false,
      created_at: new Date().toISOString(),
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
        'title' | 'description' | 'type' | 'points' | 'repeat_every_days' | 'due_on' | 'is_private'
      >;
      tasks.unshift({
        ...task,
        id: `e2e-task-${String(tasks.length)}`,
        household_id: ownHousehold.id,
        created_by: user.id,
        picked_up_by: null,
        created_at: new Date().toISOString(),
        completed_at: null,
        completed_by: null,
      });
      return reply(route, 201);
    }
    const householdId = ownHousehold?.id;
    // The news asks for the household's shared tasks done since a date (`completed_at=gte.<timestamp>`), newest
    // first, with their likes and comments.
    const doneSince = new URL(request.url()).searchParams.get('completed_at');
    if (doneSince?.startsWith('gte.')) {
      const since = doneSince.slice('gte.'.length);
      const done = tasks.filter(
        (task) =>
          task.household_id === householdId &&
          !task.is_private &&
          task.completed_at !== null &&
          task.completed_at >= since,
      );
      return reply(
        route,
        200,
        done
          .sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)))
          .map((task) => ({
            ...task,
            task_likes: likes.filter((like) => like.task_id === task.id),
            task_comments: comments.filter((comment) => comment.task_id === task.id),
          })),
      );
    }
    // "Show completed" asks for the household's done shared tasks (`completed_at=not.is.null`), newest first.
    if (new URL(request.url()).searchParams.get('completed_at') === 'not.is.null') {
      const done = tasks.filter(
        (task) =>
          task.household_id === householdId && task.completed_at !== null && !task.is_private,
      );
      return reply(
        route,
        200,
        done.sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at))),
      );
    }
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
      created_at: new Date().toISOString(),
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
      if (pickedUpBy === null) reminders.delete(task_id);
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
      task_points: number | null;
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

  /** The names of the user's favourite tasks in lower case, like favourite_tasks with Row Level Security. */
  const favourites = new Set<string>();

  /** Lists, adds (failing like the primary key for a duplicate) or removes the user's favourites. */
  async function favouritesEndpoint(route: Route) {
    const request = route.request();
    if (request.method() === 'POST') {
      const { title_key } = request.postDataJSON() as { title_key: string };
      if (favourites.has(title_key))
        return reply(route, 409, { code: '23505', message: 'Duplicate' });
      favourites.add(title_key);
      return reply(route, 201);
    }
    if (request.method() === 'DELETE') {
      favourites.delete(filterIds(new URL(request.url()).searchParams.get('title_key'))[0] ?? '');
      return reply(route, 204);
    }
    return reply(
      route,
      200,
      [...favourites].map((title_key) => ({ title_key })),
    );
  }

  /** Likes and comments, like task_likes and task_comments with Row Level Security. */
  const likes: { task_id: string; user_id: string }[] = [];
  const comments: {
    id: string;
    task_id: string;
    author_id: string;
    body: string;
    created_at: string;
  }[] = [];

  /** Adds or takes back the user's like. */
  async function likesEndpoint(route: Route) {
    const request = route.request();
    if (request.method() === 'POST') {
      const { task_id } = request.postDataJSON() as { task_id: string };
      likes.push({ task_id, user_id: user.id });
      return reply(route, 201);
    }
    const taskId = filterIds(new URL(request.url()).searchParams.get('task_id'))[0];
    likes.splice(0, likes.length, ...likes.filter((like) => like.task_id !== taskId));
    return reply(route, 204);
  }

  /** Adds or deletes the user's comments. */
  async function commentsEndpoint(route: Route) {
    const request = route.request();
    if (request.method() === 'POST') {
      const { task_id, body } = request.postDataJSON() as { task_id: string; body: string };
      comments.push({
        id: `e2e-comment-${String(comments.length)}`,
        task_id,
        author_id: user.id,
        body,
        created_at: new Date().toISOString(),
      });
      return reply(route, 201);
    }
    const id = filterIds(new URL(request.url()).searchParams.get('id'))[0];
    comments.splice(0, comments.length, ...comments.filter((comment) => comment.id !== id));
    return reply(route, 204);
  }

  /** The user's reminders by task id, like task_reminders with Row Level Security. */
  const reminders = new Map<string, string>();

  /** Like set_task_reminder(): only for an open task the user picked up or added privately. */
  async function setTaskReminder(route: Route) {
    const { task_id, remind_at } = route.request().postDataJSON() as {
      task_id: string;
      remind_at: string;
    };
    const task = ownOpenTask(task_id);
    const isToDo =
      task && (task.picked_up_by === user.id || (task.is_private && task.created_by === user.id));
    if (!isToDo) return reply(route, 400, { code: 'P0002', message: 'No open task of yours' });
    reminders.set(task_id, remind_at);
    return reply(route, 204);
  }

  async function clearTaskReminder(route: Route) {
    const { task_id } = route.request().postDataJSON() as { task_id: string };
    reminders.delete(task_id);
    return reply(route, 204);
  }

  /**
   * Like household_statistics(): each member's shared tasks done (with points, and how many of those
   * were meta work) and added since `since`.
   */
  async function householdStatistics(route: Route) {
    const { since } = route.request().postDataJSON() as { since: string | null };
    const inPeriod = (timestamp: string | null) =>
      timestamp !== null && (since === null || timestamp >= since);
    const shared = tasks.filter(
      (task) => task.household_id === ownHousehold?.id && !task.is_private,
    );
    const userIds = ownHousehold ? (members.get(ownHousehold.id) ?? []) : [];
    return reply(
      route,
      200,
      userIds.map((id) => {
        const done = shared.filter(
          (task) => task.completed_by === id && inPeriod(task.completed_at),
        );
        const metaDone = done.filter((task) => task.type === 'meta');
        return {
          user_id: id,
          display_name: profiles.get(id) ?? null,
          done: done.length,
          points: done.reduce((total, task) => total + (task.points ?? 0), 0),
          created: shared.filter((task) => task.created_by === id && inPeriod(task.created_at))
            .length,
          meta_done: metaDone.length,
          meta_points: metaDone.reduce((total, task) => total + (task.points ?? 0), 0),
        };
      }),
    );
  }

  /**
   * Like task_suggestions(): one per title (ignoring case) with its newest details, most often added
   * first. Simplified: repeats a task added itself count too.
   */
  async function taskSuggestions(route: Route) {
    const byTitle = new Map<string, TaskRow[]>();
    const visible = tasks.filter(
      (task) =>
        task.household_id === ownHousehold?.id && (!task.is_private || task.created_by === user.id),
    );
    for (const task of visible) {
      const key = task.title.toLowerCase();
      byTitle.set(key, [...(byTitle.get(key) ?? []), task]);
    }
    const suggestions = [...byTitle.values()].map((occurrences) => {
      // `tasks` is newest first.
      const [newest] = occurrences as [TaskRow, ...TaskRow[]];
      return {
        title: newest.title,
        description: newest.description,
        type: newest.type,
        points: newest.points,
        repeat_every_days: newest.repeat_every_days,
        is_private: newest.is_private,
        times_added: occurrences.length,
        is_open: occurrences.some((task) => task.completed_at === null),
      };
    });
    return reply(
      route,
      200,
      suggestions.sort((a, b) => b.times_added - a.times_added),
    );
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
    '/rest/v1/rpc/household_statistics': householdStatistics,
    '/rest/v1/rpc/task_suggestions': taskSuggestions,
    '/rest/v1/rpc/set_task_reminder': setTaskReminder,
    '/rest/v1/rpc/clear_task_reminder': clearTaskReminder,
    '/rest/v1/task_reminders': (route) =>
      reply(
        route,
        200,
        [...reminders].map(([task_id, remind_at]) => ({ task_id, remind_at })),
      ),
    '/rest/v1/favourite_tasks': favouritesEndpoint,
    '/rest/v1/task_likes': likesEndpoint,
    '/rest/v1/task_comments': commentsEndpoint,
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
