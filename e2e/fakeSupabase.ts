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
  /** Ben's personal goal. */
  goal: 'New bike',
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

interface GoalRow {
  id: string;
  household_id: string;
  title: string;
  target_points: number;
  owner_id: string | null;
  min_points_per_member: number | null;
  created_at: string;
  claimed_at: string | null;
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

  // Ben has a goal of his own, which the family sees.
  const goals: GoalRow[] = [
    {
      id: 'e2e-ben-goal',
      household_id: existing.id,
      title: EXISTING_HOUSEHOLD.goal,
      target_points: 10,
      owner_id: 'e2e-ben',
      min_points_per_member: null,
      created_at: new Date().toISOString(),
      claimed_at: null,
    },
  ];

  /** Like the select policy on goals: every goal in the user's household. */
  function visibleGoals() {
    return goals.filter((goal) => goal.household_id === ownHousehold?.id);
  }

  /** Like the delete policy and claim_goal_reward(): an open family goal or the user's own. */
  function ownOpenGoal(goalId: string | undefined) {
    return visibleGoals().find(
      (goal) =>
        goal.id === goalId &&
        goal.claimed_at === null &&
        (goal.owner_id === null || goal.owner_id === user.id),
    );
  }

  /** Like goal_points(): shared tasks done since the goal was set, by `doneBy` (anyone when null). */
  function goalPoints(goal: GoalRow, doneBy = goal.owner_id) {
    return tasks
      .filter(
        (task) =>
          task.household_id === goal.household_id &&
          !task.is_private &&
          task.completed_at !== null &&
          task.completed_at >= goal.created_at &&
          (goal.claimed_at === null || task.completed_at <= goal.claimed_at) &&
          (doneBy === null || task.completed_by === doneBy),
      )
      .reduce((total, task) => total + (task.points ?? 0), 0);
  }

  /** Like goal_member_points(): what each current member has earned towards a family goal. */
  function memberPoints(goal: GoalRow) {
    return (members.get(goal.household_id) ?? []).map((id) => ({
      user_id: id,
      display_name: profiles.get(id) ?? null,
      points: goalPoints(goal, id),
    }));
  }

  /** Like goal_is_reached(). */
  function isReached(goal: GoalRow) {
    const minimum = goal.min_points_per_member;
    return (
      goalPoints(goal) >= goal.target_points &&
      (minimum === null || memberPoints(goal).every(({ points }) => points >= minimum))
    );
  }

  async function goalsEndpoint(route: Route) {
    const request = route.request();
    if (request.method() === 'POST') {
      if (!ownHousehold) return reply(route, 400, { code: '23502', message: 'No household' });
      const goal = request.postDataJSON() as Pick<
        GoalRow,
        'title' | 'target_points' | 'owner_id' | 'min_points_per_member'
      >;
      goals.push({
        ...goal,
        id: `e2e-goal-${String(goals.length)}`,
        household_id: ownHousehold.id,
        created_at: new Date().toISOString(),
        claimed_at: null,
      });
      return reply(route, 201);
    }
    // DELETE, filtered by `id=eq.<id>`, for an open goal only.
    const [id] = filterIds(new URL(request.url()).searchParams.get('id'));
    const goal = ownOpenGoal(id);
    if (goal) goals.splice(goals.indexOf(goal), 1);
    return reply(route, 204);
  }

  /**
   * Like household_goals(): open goals first, newest first, then claimed ones, with owners' names,
   * whether each is reached and, for family goals, what each member has earned.
   */
  async function householdGoals(route: Route) {
    const open = visibleGoals().filter((goal) => goal.claimed_at === null);
    const claimed = visibleGoals().filter((goal) => goal.claimed_at !== null);
    return reply(
      route,
      200,
      [...open.reverse(), ...claimed.reverse()].map((goal) => ({
        ...goal,
        owner_name: goal.owner_id ? (profiles.get(goal.owner_id) ?? null) : null,
        points: goalPoints(goal),
        reached: isReached(goal),
        member_points: goal.owner_id === null ? memberPoints(goal) : null,
      })),
    );
  }

  /** Like claim_goal_reward(). */
  async function claimGoalReward(route: Route) {
    const { goal_id } = route.request().postDataJSON() as { goal_id: string };
    const goal = ownOpenGoal(goal_id);
    if (!goal) return reply(route, 400, { code: 'P0002', message: 'No open goal with this id' });
    if (!isReached(goal)) {
      return reply(route, 400, { code: '23514', message: 'This goal has not been reached yet' });
    }
    goal.claimed_at = new Date().toISOString();
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
    '/rest/v1/tasks': tasksEndpoint,
    '/rest/v1/goals': goalsEndpoint,
    '/rest/v1/rpc/household_goals': householdGoals,
    '/rest/v1/rpc/claim_goal_reward': claimGoalReward,
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
