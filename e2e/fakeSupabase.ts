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
/** The sign-in code every child without email gets here. */
export const CHILD_SIGN_IN_CODE = 'KX7P29QF';

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
  for_children: boolean;
  created_at: string;
  completed_at: string | null;
  completed_by: string | null;
  previous_task_id: string | null;
}

interface GoalRow {
  id: string;
  household_id: string;
  title: string;
  target_points: number;
  owner_id: string | null;
  /** Who takes part in a shared goal (goal_participants); empty for a personal one. */
  participants: { user_id: string; min_points: number | null }[];
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

/** A 1×1 picture, served for every task picture: uploads arrive as form data, not the picture alone. */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

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
      for_children: false,
      created_at: new Date().toISOString(),
      completed_at: null,
      completed_by: null,
      previous_task_id: null,
    },
  ];

  /** Uploaded task picture files (the task-images bucket). */
  const imageFiles = new Set<string>();
  /** The pictures of each task in order (task_images), by task id. */
  const taskImages = new Map<string, string[]>();

  /** Like Storage for the task-images bucket: uploads, signed URLs, the signed files and deleting. */
  async function storageEndpoint(route: Route, pathname: string) {
    const request = route.request();
    const upload = /^\/storage\/v1\/object\/task-images\/(.+)$/.exec(pathname)?.[1];
    if (request.method() === 'POST' && upload) {
      imageFiles.add(decodeURIComponent(upload));
      return reply(route, 200, { Key: `task-images/${upload}`, Id: upload });
    }
    if (pathname === '/storage/v1/object/sign/task-images') {
      const { paths } = request.postDataJSON() as { paths: string[] };
      return reply(
        route,
        200,
        paths.map((path) => ({
          path,
          signedURL: imageFiles.has(path) ? `/object/sign/task-images/${path}?token=e2e` : null,
          error: imageFiles.has(path) ? null : 'Not found',
        })),
      );
    }
    if (pathname.startsWith('/storage/v1/object/sign/task-images/')) {
      return route.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG });
    }
    if (request.method() === 'DELETE' && pathname === '/storage/v1/object/task-images') {
      const { prefixes } = request.postDataJSON() as { prefixes: string[] };
      const inUse = new Set([...taskImages.values()].flat());
      const deleted = prefixes.filter((path) => !inUse.has(path) && imageFiles.delete(path));
      return reply(
        route,
        200,
        deleted.map((name) => ({ name })),
      );
    }
    return reply(route, 404, { message: `Not faked: ${pathname}` });
  }

  /** Like set_task_images(), without its checks. */
  async function setTaskImages(route: Route) {
    const { task_id, paths } = route.request().postDataJSON() as {
      task_id: string;
      paths: string[];
    };
    taskImages.set(task_id, paths);
    return reply(route, 204);
  }

  /** A task with its pictures, like `task_images(path, position)` embedded in the select. */
  function withImages(task: TaskRow) {
    return {
      ...task,
      task_images: (taskImages.get(task.id) ?? []).map((path, position) => ({ path, position })),
    };
  }

  /** A task with the occurrence it repeats, like `previous_occurrence(completed_by, completed_at)` embedded. */
  function withPrevious<T extends TaskRow>(task: T) {
    const previous = tasks.find((candidate) => candidate.id === task.previous_task_id);
    return {
      ...task,
      previous: previous
        ? { completed_by: previous.completed_by, completed_at: previous.completed_at }
        : null,
    };
  }

  /** Who helped with each done task and their shares (task_helpers), by task id. */
  const helpers = new Map<string, { user_id: string; points: number }[]>();

  /** A task with who helped, like `task_helpers(user_id, points)` embedded in the select. */
  function withHelpers(task: TaskRow) {
    return { ...task, task_helpers: helpers.get(task.id) ?? [] };
  }

  /** Like private.task_credits: the doer gets what the helpers didn't, each helper their share. */
  function creditsOf(task: TaskRow): { user_id: string | null; points: number }[] {
    if (task.completed_at === null || task.is_private) return [];
    const shares = helpers.get(task.id) ?? [];
    const helped = shares.reduce((total, share) => total + share.points, 0);
    return [{ user_id: task.completed_by, points: (task.points ?? 0) - helped }, ...shares];
  }

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

  /** Members an adult has marked as children; the user is never one. */
  const children = new Set<string>();
  /** Children added without email, who sign in with codes. */
  const childAccounts = new Set<string>();

  /** The app asks for its household's members, or whether the user is a child. */
  async function membersEndpoint(route: Route) {
    const userIds = ownHousehold ? (members.get(ownHousehold.id) ?? []) : [];
    const wanted = filterIds(new URL(route.request().url()).searchParams.get('user_id'));
    return replyWithRows(
      route,
      userIds
        .filter((id) => wanted.length === 0 || wanted.includes(id))
        .map((id) => ({
          user_id: id,
          household_id: ownHousehold?.id,
          is_child: children.has(id),
          signs_in_with_code: childAccounts.has(id),
          can_add_tasks: false,
        })),
    );
  }

  /** Like set_member_is_child(), for another member of the user's household. */
  async function setMemberIsChild(route: Route) {
    const { member_id, is_child } = route.request().postDataJSON() as {
      member_id: string;
      is_child: boolean;
    };
    const others = ownHousehold ? (members.get(ownHousehold.id) ?? []) : [];
    if (member_id === user.id || !others.includes(member_id)) {
      return reply(route, 400, { code: 'P0002', message: 'No other member with this id' });
    }
    if (is_child) children.add(member_id);
    else children.delete(member_id);
    return reply(route, 204);
  }

  async function tasksEndpoint(route: Route) {
    const request = route.request();
    if (request.method() === 'POST') {
      if (!ownHousehold) return reply(route, 400, { code: '23502', message: 'No household' });
      const task = request.postDataJSON() as Pick<
        TaskRow,
        | 'title'
        | 'description'
        | 'type'
        | 'points'
        | 'repeat_every_days'
        | 'due_on'
        | 'is_private'
        | 'for_children'
      >;
      const id = `e2e-task-${String(tasks.length)}`;
      tasks.unshift({
        ...task,
        id,
        household_id: ownHousehold.id,
        created_by: user.id,
        picked_up_by: null,
        created_at: new Date().toISOString(),
        completed_at: null,
        completed_by: null,
        previous_task_id: null,
      });
      return replyWithRows(route, [{ id }]);
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
            ...withHelpers(task),
            task_likes: likes.filter((like) => like.task_id === task.id),
            task_comments: comments.filter((comment) => comment.task_id === task.id),
          })),
      );
    }
    // Adults are asked to award the points of children's tasks waiting for them (`points=is.null`); everyone
    // here is an adult, so none wait.
    if (new URL(request.url()).searchParams.get('points') === 'is.null') {
      return reply(
        route,
        200,
        tasks.filter(
          (task) => task.household_id === householdId && !task.is_private && task.points === null,
        ),
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
        done
          .sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)))
          .map(withHelpers),
      );
    }
    // The Me screen asks for the user's completed tasks (`completed_by=eq.<id>`), newest first.
    const completedBy = new URL(request.url()).searchParams.get('completed_by');
    if (completedBy) {
      const done = tasks.filter((task) => `eq.${String(task.completed_by)}` === completedBy);
      return reply(
        route,
        200,
        done
          .sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)))
          .map(withHelpers),
      );
    }
    return reply(
      route,
      200,
      tasks
        .filter((task) => task.household_id === householdId && task.completed_at === null)
        // Stable sort, so tasks with the same due date (or none) stay newest first.
        .sort((a, b) => (a.due_on ?? '9999-12-31').localeCompare(b.due_on ?? '9999-12-31'))
        .map((task) => withPrevious(withImages(task))),
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
      previous_task_id: task.id,
    };
    tasks.unshift(next);
    taskImages.set(next.id, [...(taskImages.get(task.id) ?? [])]);
    return reply(route, 200, next.id);
  }

  /** Like set_task_helpers(): who helped with a task the user did, sharing at most its points. */
  async function setTaskHelpers(route: Route) {
    const { task_id, helpers: shares } = route.request().postDataJSON() as {
      task_id: string;
      helpers: { user_id: string; points: number }[];
    };
    const task = tasks.find(
      (candidate) => candidate.id === task_id && candidate.completed_by === user.id,
    );
    if (task?.points === undefined || task.points === null) {
      return reply(route, 400, { code: 'P0002', message: 'No task of yours done this week' });
    }
    if (shares.reduce((total, share) => total + share.points, 0) > task.points) {
      return reply(route, 400, { code: '23514', message: 'More than the task points' });
    }
    helpers.set(task_id, shares);
    return reply(route, 200, null);
  }

  /** Like own_total_points(): the user's credits in their household. */
  async function ownTotalPoints(route: Route) {
    const total = tasks
      .filter((task) => task.household_id === ownHousehold?.id)
      .flatMap(creditsOf)
      .filter((credit) => credit.user_id === user.id)
      .reduce((sum, credit) => sum + credit.points, 0);
    return reply(route, 200, total);
  }

  /** Like own_helped_tasks(): the done tasks in the user's household they helped with, newest first. */
  async function ownHelpedTasks(route: Route) {
    const helped = tasks.flatMap((task) => {
      const share = helpers.get(task.id)?.find((helper) => helper.user_id === user.id);
      if (!share || task.completed_at === null || task.household_id !== ownHousehold?.id) return [];
      const { id, title, type, completed_at, completed_by } = task;
      return [{ task_id: id, title, type, points: share.points, completed_at, completed_by }];
    });
    return reply(
      route,
      200,
      helped.sort((a, b) => b.completed_at.localeCompare(a.completed_at)),
    );
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
      if (pickedUpBy === null) {
        reminders.delete(task_id);
        schedules.delete(task_id);
      }
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
      task_for_children: boolean;
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
      for_children: body.task_for_children,
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

  /** The user's schedule by task id, like task_schedules with Row Level Security. */
  const schedules = new Map<string, { starts_at: string; duration_minutes: number }>();

  /** Like set_task_schedule(): only for an open task the user picked up or added privately. */
  async function setTaskSchedule(route: Route) {
    const { task_id, starts_at, duration_minutes } = route.request().postDataJSON() as {
      task_id: string;
      starts_at: string;
      duration_minutes: number;
    };
    const task = ownOpenTask(task_id);
    const isToDo =
      task && (task.picked_up_by === user.id || (task.is_private && task.created_by === user.id));
    if (!isToDo) return reply(route, 400, { code: 'P0002', message: 'No open task of yours' });
    schedules.set(task_id, { starts_at, duration_minutes });
    return reply(route, 204);
  }

  async function clearTaskSchedule(route: Route) {
    const { task_id } = route.request().postDataJSON() as { task_id: string };
    schedules.delete(task_id);
    return reply(route, 204);
  }

  /**
   * Like household_statistics(): whether each member is a child, and their shared tasks done (with
   * points, and how many of those were meta work) and added since `since`.
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
        const done = shared.flatMap((task) =>
          inPeriod(task.completed_at)
            ? creditsOf(task)
                .filter((credit) => credit.user_id === id)
                .map((credit) => ({ type: task.type, points: credit.points }))
            : [],
        );
        const metaDone = done.filter((credit) => credit.type === 'meta');
        return {
          user_id: id,
          display_name: profiles.get(id) ?? null,
          is_child: children.has(id),
          done: done.length,
          points: done.reduce((total, credit) => total + credit.points, 0),
          created: shared.filter((task) => task.created_by === id && inPeriod(task.created_at))
            .length,
          meta_done: metaDone.length,
          meta_points: metaDone.reduce((total, credit) => total + credit.points, 0),
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
        for_children: newest.for_children,
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
      participants: [],
      created_at: new Date().toISOString(),
      claimed_at: null,
    },
  ];

  /** Like the select policy on goals: every goal in the user's household. */
  function visibleGoals() {
    return goals.filter((goal) => goal.household_id === ownHousehold?.id);
  }

  /** Like the delete policy: any open goal in the household. */
  function openGoal(goalId: string | undefined) {
    return visibleGoals().find((goal) => goal.id === goalId && goal.claimed_at === null);
  }

  /** Like claim_goal_reward(): an open shared goal the user takes part in, or their own. */
  function ownOpenGoal(goalId: string | undefined) {
    const goal = openGoal(goalId);
    const takesPart = goal?.participants.some((participant) => participant.user_id === user.id);
    return goal && (goal.owner_id === user.id || takesPart) ? goal : undefined;
  }

  /** Like goal_points(): shared tasks done since the goal was set, credited to `doneBy` (participants when null). */
  function goalPoints(goal: GoalRow, doneBy = goal.owner_id) {
    const counts = (userId: string | null) =>
      doneBy === null
        ? goal.participants.some((participant) => participant.user_id === userId)
        : userId === doneBy;
    return tasks
      .filter(
        (task) =>
          task.household_id === goal.household_id &&
          task.completed_at !== null &&
          task.completed_at >= goal.created_at &&
          (goal.claimed_at === null || task.completed_at <= goal.claimed_at),
      )
      .flatMap(creditsOf)
      .filter((credit) => counts(credit.user_id))
      .reduce((total, credit) => total + credit.points, 0);
  }

  /** Like goal_participant_points(): what each participant has earned. */
  function participantPoints(goal: GoalRow) {
    return (members.get(goal.household_id) ?? []).flatMap((id) => {
      const participant = goal.participants.find(({ user_id }) => user_id === id);
      if (!participant) return [];
      const name = profiles.get(id) ?? null;
      return [{ ...participant, display_name: name, points: goalPoints(goal, id) }];
    });
  }

  /** Like goal_is_reached(). */
  function isReached(goal: GoalRow) {
    return (
      goalPoints(goal) >= goal.target_points &&
      participantPoints(goal).every(
        ({ points, min_points }) => min_points === null || points >= min_points,
      )
    );
  }

  function addGoal(goal: Pick<GoalRow, 'title' | 'target_points' | 'owner_id' | 'participants'>) {
    if (!ownHousehold) return false;
    goals.push({
      ...goal,
      id: `e2e-goal-${String(goals.length)}`,
      household_id: ownHousehold.id,
      created_at: new Date().toISOString(),
      claimed_at: null,
    });
    return true;
  }

  /** Like add_shared_goal(), without its checks. */
  async function addSharedGoal(route: Route) {
    const goal = route.request().postDataJSON() as Pick<
      GoalRow,
      'title' | 'target_points' | 'participants'
    >;
    if (!addGoal({ ...goal, owner_id: null })) {
      return reply(route, 400, { code: '42501', message: 'No household' });
    }
    return reply(route, 200, goals.at(-1)?.id);
  }

  async function goalsEndpoint(route: Route) {
    const request = route.request();
    if (request.method() === 'POST') {
      const goal = request.postDataJSON() as Pick<GoalRow, 'title' | 'target_points' | 'owner_id'>;
      if (!addGoal({ ...goal, participants: [] })) {
        return reply(route, 400, { code: '23502', message: 'No household' });
      }
      return reply(route, 201);
    }
    // DELETE, filtered by `id=eq.<id>`, for an open goal only.
    const [id] = filterIds(new URL(request.url()).searchParams.get('id'));
    const goal = openGoal(id);
    if (goal) goals.splice(goals.indexOf(goal), 1);
    return reply(route, 204);
  }

  /**
   * Like household_goals(): open goals first, newest first, then claimed ones, with owners' names,
   * whether each is reached and, for shared goals, what each participant has earned.
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
        participants: goal.owner_id === null ? participantPoints(goal) : null,
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

  /** Every code is the same here; the real one is random (`issue_child_sign_in_code()`). */
  function signInCode() {
    return {
      code: CHILD_SIGN_IN_CODE,
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  }

  /** Like the add-child Edge Function. */
  async function addChild(route: Route) {
    if (!ownHousehold) return reply(route, 403, { error: 'not_an_adult' });
    const { displayName } = route.request().postDataJSON() as { displayName: string };
    const childId = `e2e-child-${String(childAccounts.size)}`;
    profiles.set(childId, displayName);
    members.set(ownHousehold.id, [...(members.get(ownHousehold.id) ?? []), childId]);
    children.add(childId);
    childAccounts.add(childId);
    const { code, expires_at } = signInCode();
    return reply(route, 200, { code, expiresAt: expires_at });
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
    '/rest/v1/rpc/set_member_is_child': setMemberIsChild,
    '/rest/v1/rpc/household_invite_code': (route) =>
      reply(route, 200, ownHousehold?.invite_code ?? null),
    '/rest/v1/rpc/new_child_sign_in_code': (route) => replyWithRows(route, [signInCode()]),
    '/functions/v1/add-child': addChild,
    // The fake has one user, Anna, so no code signs anyone in.
    '/functions/v1/child-sign-in': (route) => reply(route, 401, { error: 'unknown_code' }),
    '/rest/v1/rpc/complete_task': completeTask,
    '/rest/v1/rpc/set_task_helpers': setTaskHelpers,
    '/rest/v1/rpc/own_total_points': ownTotalPoints,
    '/rest/v1/rpc/own_helped_tasks': ownHelpedTasks,
    '/rest/v1/rpc/pick_up_task': setPickedUp(user.id),
    '/rest/v1/rpc/put_back_task': setPickedUp(null),
    '/rest/v1/rpc/update_task': updateTask,
    '/rest/v1/rpc/delete_task': deleteTask,
    '/rest/v1/rpc/set_task_images': setTaskImages,
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
    '/rest/v1/rpc/set_task_schedule': setTaskSchedule,
    '/rest/v1/rpc/clear_task_schedule': clearTaskSchedule,
    '/rest/v1/task_schedules': (route) =>
      reply(
        route,
        200,
        [...schedules].map(([task_id, schedule]) => ({ task_id, ...schedule })),
      ),
    '/rest/v1/favourite_tasks': favouritesEndpoint,
    '/rest/v1/task_likes': likesEndpoint,
    '/rest/v1/task_comments': commentsEndpoint,
    '/rest/v1/tasks': tasksEndpoint,
    '/rest/v1/goals': goalsEndpoint,
    '/rest/v1/rpc/household_goals': householdGoals,
    '/rest/v1/rpc/add_shared_goal': addSharedGoal,
    '/rest/v1/rpc/claim_goal_reward': claimGoalReward,
  };

  await page.route(`${FAKE_SUPABASE_URL}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname.replace(/^\/fake-supabase/, '');
    if (pathname.startsWith('/storage/v1/object/')) return storageEndpoint(route, pathname);
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
