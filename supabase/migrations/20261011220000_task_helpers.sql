-- Helping with a task (ADR 0004): whoever marked a shared task done can say who helped them, e.g. a child who helped
-- with the laundry or another adult who shared the task, and give each helper some of the task's points. The task is
-- worth the same as before: what helpers get comes out of the doer's points, so adding helpers never inflates
-- totals, statistics or goals. Every count of who earned what now reads private.task_credits.

create table public.task_helpers (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The helper's share of the task's points; set_task_helpers() keeps the shares within the task's points.
  points smallint not null check (points between 1 and 10),
  primary key (task_id, user_id)
);
create index task_helpers_user_id_idx on public.task_helpers (user_id);

alter table public.task_helpers enable row level security;

-- Helpers are set only by set_task_helpers() and go when the task is undone.
revoke all on table public.task_helpers from anon, authenticated;
grant select on table public.task_helpers to authenticated;

create policy "Members can view who helped with tasks they can see"
  on public.task_helpers for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_helpers.task_id));

-- Who earned the points of each done shared task: the doer what the helpers didn't get, and each helper their share.
-- A task waiting for points credits its doer null points. Only the security definer functions below read it.
create view private.task_credits as
  select t.id as task_id, t.household_id, t.completed_by as user_id, t.type, t.completed_at,
    (t.points - coalesce((select sum(h.points) from public.task_helpers h where h.task_id = t.id), 0))::integer
      as points
  from public.tasks t
  where t.completed_by is not null and not t.is_private
  union all
  select t.id, t.household_id, h.user_id, t.type, t.completed_at, h.points::integer
  from public.task_helpers h
  join public.tasks t on t.id = h.task_id
  where t.completed_at is not null and not t.is_private;
revoke all on table private.task_credits from public, anon, authenticated;

-- Sets who helped with a shared task the user marked done in the last week, and their shares of its points:
-- helpers = [{"user_id": "…", "points": 2}, …], replacing earlier ones; [] for nobody. Raises no_data_found (P0002)
-- unless the user marked the task done in the last week and it has points, insufficient_privilege (42501) for a
-- helper who is the user or outside the household, and check_violation (23514) for someone listed twice, a share
-- outside 1–10, or shares that together are more than the task's points.
create function public.set_task_helpers(task_id uuid, helpers jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  done public.tasks;
begin
  if jsonb_typeof(set_task_helpers.helpers) is distinct from 'array' then
    raise exception 'List who helped' using errcode = '22023';
  end if;
  -- The row lock makes a second, simultaneous save wait, so the shares can't add up to more than the points.
  select * into done from public.tasks t
    where t.id = set_task_helpers.task_id
      and private.can_see_task(t)
      and t.completed_by = auth.uid()
      and t.completed_at > now() - interval '7 days'
      and not t.is_private
      and t.points is not null
    for update;
  if done.id is null then
    raise exception 'You have not marked this task done in the last week' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(set_task_helpers.helpers) as h (user_id uuid, points integer)
      where h.user_id is null or h.user_id = auth.uid() or not exists (
        select 1 from public.household_members m where m.user_id = h.user_id and m.household_id = done.household_id
      )
  ) then
    raise exception 'Helpers are other members of the household' using errcode = '42501';
  end if;
  if (
    select count(distinct h.user_id)
      from jsonb_to_recordset(set_task_helpers.helpers) as h (user_id uuid, points integer)
  ) <> jsonb_array_length(set_task_helpers.helpers) then
    raise exception 'Someone is listed twice' using errcode = '23514';
  end if;
  if (
    select coalesce(sum(h.points), 0)
      from jsonb_to_recordset(set_task_helpers.helpers) as h (user_id uuid, points integer)
  ) > done.points then
    raise exception 'Helpers can share at most the task''s points' using errcode = '23514';
  end if;
  delete from public.task_helpers h where h.task_id = done.id;
  insert into public.task_helpers (task_id, user_id, points)
    select done.id, h.user_id, h.points
      from jsonb_to_recordset(set_task_helpers.helpers) as h (user_id uuid, points smallint);
end;
$$;
revoke execute on function public.set_task_helpers(uuid, jsonb) from public, anon;
grant execute on function public.set_task_helpers(uuid, jsonb) to authenticated;

-- The user's points in their household, also their shares of tasks they helped with but may not see (a child helping
-- with an adults-only task). Replaces summing task rows in the app.
create function public.own_total_points()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(c.points), 0)::integer from private.task_credits c
  where c.user_id = auth.uid() and c.household_id = (select private.current_household_id());
$$;
revoke execute on function public.own_total_points() from public, anon;
grant execute on function public.own_total_points() to authenticated;

-- As before (20261011100000_children.sql), and undoing a task also removes who helped with it.
create or replace function public.undo_complete_task(task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  done public.tasks;
begin
  select * into done from public.tasks t
    where t.id = undo_complete_task.task_id
      and private.can_see_task(t)
      and t.completed_by = auth.uid()
      and t.completed_at > now() - interval '1 hour'
    for update;
  if done.id is null or exists (
    select 1 from public.tasks t where t.previous_task_id = done.id and not private.can_see_task(t)
  ) then
    raise exception 'You have not marked this task done in the last hour' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.tasks t where t.previous_task_id = done.id and t.completed_at is not null
  ) then
    raise exception 'The next occurrence of this task is already done' using errcode = '55006';
  end if;
  delete from public.tasks t where t.previous_task_id = done.id;
  delete from public.task_helpers h where h.task_id = done.id;
  update public.tasks t set completed_at = null, completed_by = null where t.id = done.id;
end;
$$;

-- As before (20261011210000_statistics_by_member_group.sql), but counting credits: a task someone helped with counts
-- as done for them too, with their share of its points.
create or replace function public.household_statistics(since timestamptz)
returns table (
  user_id uuid,
  display_name text,
  is_child boolean,
  done integer,
  points integer,
  created integer,
  meta_done integer,
  meta_points integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.user_id,
    p.display_name,
    m.is_child,
    credits.done,
    coalesce(credits.points, 0),
    (
      select count(*)::integer from public.tasks t
      where t.household_id = m.household_id and t.created_by = m.user_id and not t.is_private
        and t.created_at >= coalesce(household_statistics.since, '-infinity')
    ),
    credits.meta_done,
    coalesce(credits.meta_points, 0)
  from public.household_members m
  left join public.profiles p on p.id = m.user_id
  cross join lateral (
    select
      count(*)::integer as done,
      sum(c.points)::integer as points,
      (count(*) filter (where c.type = 'meta'))::integer as meta_done,
      (sum(c.points) filter (where c.type = 'meta'))::integer as meta_points
    from private.task_credits c
    where c.household_id = m.household_id and c.user_id = m.user_id
      and c.completed_at >= coalesce(household_statistics.since, '-infinity')
  ) credits
  where m.household_id = (select private.current_household_id())
  order by m.joined_at, m.user_id;
$$;

-- As before (20261011180000_goal_participants.sql), counting each participant's or the owner's credits, so helpers'
-- shares count towards their goals.
create or replace function private.goal_points(goal public.goals)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(c.points), 0)::integer from private.task_credits c
  where c.household_id = goal.household_id
    and c.completed_at >= goal.created_at
    and c.completed_at <= coalesce(goal.claimed_at, 'infinity')
    and (
      c.user_id = goal.owner_id
      or exists (
        select 1 from public.goal_participants gp where gp.goal_id = goal.id and gp.user_id = c.user_id
      )
    );
$$;

create or replace function private.goal_participant_points(goal public.goals)
returns table (user_id uuid, display_name text, points integer, min_points integer, joined_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select gp.user_id, p.display_name, coalesce(sum(c.points), 0)::integer, gp.min_points, m.joined_at
  from public.goal_participants gp
  join public.household_members m on m.user_id = gp.user_id and m.household_id = goal.household_id
  left join public.profiles p on p.id = gp.user_id
  left join private.task_credits c
    on c.household_id = goal.household_id
    and c.user_id = gp.user_id
    and c.completed_at >= goal.created_at
    and c.completed_at <= coalesce(goal.claimed_at, 'infinity')
  where gp.goal_id = goal.id
  group by gp.user_id, p.display_name, gp.min_points, m.joined_at;
$$;
