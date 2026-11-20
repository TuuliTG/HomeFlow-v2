-- Shared tasks without points, e.g. reminders like "Dentist on Thursday" (ADR 0004): an adult gives a shared task 0
-- points (also when awarding or editing a child's task). Such a task earns nothing and counts for nobody: statistics leave it out of both tasks done and tasks
-- created, goals and totals add nothing for it, and no one can be credited for helping with it. Null points still
-- mean a private task, or a child's shared task waiting for an adult to award its points.
alter table public.tasks
  drop constraint tasks_points_check,
  add constraint tasks_points_check check (points between 0 and 10);

-- As before (20261108120000_helper_bonus_points.sql), but a task with 0 points credits no one.
create or replace view private.task_credits as
  select t.id as task_id, t.household_id, t.completed_by as user_id, t.type, t.completed_at,
    t.points::integer as points
  from public.tasks t
  where t.completed_by is not null and not t.is_private and t.points is distinct from 0
  union all
  select t.id, t.household_id, h.user_id, t.type, t.completed_at, h.points::integer
  from public.task_helpers h
  join public.tasks t on t.id = h.task_id
  where t.completed_at is not null and not t.is_private and t.points is distinct from 0;
revoke all on table private.task_credits from public, anon, authenticated;

-- As before (20261011220000_task_helpers.sql), but a task with 0 points isn't counted as a task created.
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
        and t.points is distinct from 0
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

-- As before (20261108120000_helper_bonus_points.sql), but only a task with points can be shared, not one with 0 points.
create or replace function public.set_task_helpers(task_id uuid, helpers jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  done public.tasks;
begin
  if private.is_child(auth.uid()) then
    raise exception 'Children don''t say who helped' using errcode = '42501';
  end if;
  if jsonb_typeof(set_task_helpers.helpers) is distinct from 'array' then
    raise exception 'List who helped' using errcode = '22023';
  end if;
  -- The row lock makes a second, simultaneous save wait for the first.
  select * into done from public.tasks t
    where t.id = set_task_helpers.task_id
      and private.can_see_task(t)
      and t.completed_by = auth.uid()
      and t.completed_at > now() - interval '7 days'
      and not t.is_private
      and t.points > 0
    for update;
  if done.id is null then
    raise exception 'You have not marked this task with points done in the last week' using errcode = 'P0002';
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
  delete from public.task_helpers h where h.task_id = done.id;
  insert into public.task_helpers (task_id, user_id, points)
    select done.id, h.user_id, h.points
      from jsonb_to_recordset(set_task_helpers.helpers) as h (user_id uuid, points smallint);
end;
$$;
