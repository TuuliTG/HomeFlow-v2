-- Children (ADR 0003, ADR 0004): an adult can mark another member of their household as a child, and a task as
-- available for children. A child sees, and can act on, only tasks available for children; adults see every task.
-- Members join as adults, and only an adult can change whether a member is a child, never their own, so a
-- household always keeps the adult who made the change.
alter table public.household_members add column is_child boolean not null default false;

-- Adults only by default: an adult opts a task in for children.
alter table public.tasks add column for_children boolean not null default false;
grant insert (for_children) on table public.tasks to authenticated;

-- Whether the user is a child in their household; false for adults and for users without a household. Security
-- definer for the same reason as current_household_id(): policies can use it without recursing.
create function private.is_child(member uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select m.is_child from public.household_members m where m.user_id = member), false);
$$;
revoke execute on function private.is_child(uuid) from public;
grant execute on function private.is_child(uuid) to authenticated;

-- Whether the user may see and act on the task: in their household, shared or their own private task, and available
-- for children if they are a child. The select policy below and every security definer function acting on any open
-- task use it, so the rule is in one place.
create function private.can_see_task(task public.tasks)
returns boolean
language sql
stable
set search_path = ''
as $$
  select task.household_id = (select private.current_household_id())
    and (not task.is_private or task.created_by = (select auth.uid()))
    and (task.for_children or not (select private.is_child((select auth.uid()))));
$$;
revoke execute on function private.can_see_task(public.tasks) from public;
grant execute on function private.can_see_task(public.tasks) to authenticated;

-- Realtime applies this policy too, so children aren't sent adults' tasks live either.
drop policy "Members can view their household's shared tasks and their own private ones" on public.tasks;
create policy "Members can view the tasks of their household they may see"
  on public.tasks for select to authenticated
  using ((select private.can_see_task(tasks)));

-- A child's tasks are always available for children, so they don't lose sight of a task they add.
drop policy "Members can add tasks to their household" on public.tasks;
create policy "Members can add tasks to their household"
  on public.tasks for insert to authenticated
  with check (
    household_id = (select private.current_household_id())
    and created_by = (select auth.uid())
    and (for_children or not (select private.is_child((select auth.uid()))))
  );

-- Takes adults-only tasks back from a child: puts back the open ones they picked up and removes their reminders
-- for them, so a child never holds a task they can't see.
create function private.put_back_adults_tasks(child uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.task_reminders r
    using public.tasks t
    where r.task_id = t.id and r.user_id = child and not t.for_children;
  update public.tasks t set picked_up_by = null, picked_up_at = null
    where t.picked_up_by = child and t.completed_at is null and not t.for_children;
$$;
revoke execute on function private.put_back_adults_tasks(uuid) from public;

-- Marks another member of the adult's household as a child or an adult. Raises insufficient_privilege (42501) for a
-- child, and no_data_found (P0002) for the adult themselves or someone outside their household. A new child keeps
-- their private tasks (made available for children) and gives back the adults-only tasks they picked up.
create function public.set_member_is_child(member_id uuid, is_child boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if is_child is null then
    raise exception 'Choose child or adult' using errcode = '22023';
  end if;
  if (select private.current_household_id()) is null or private.is_child(auth.uid()) then
    raise exception 'Only an adult in the household can change who is a child' using errcode = '42501';
  end if;
  update public.household_members m set is_child = set_member_is_child.is_child
    where m.user_id = set_member_is_child.member_id
      and m.user_id <> auth.uid()
      and m.household_id = (select private.current_household_id());
  if not found then
    raise exception 'No other member with this id in your household' using errcode = 'P0002';
  end if;
  if set_member_is_child.is_child then
    update public.tasks t set for_children = true
      where t.created_by = set_member_is_child.member_id and t.is_private;
    perform private.put_back_adults_tasks(set_member_is_child.member_id);
  end if;
end;
$$;

revoke execute on function public.set_member_is_child(uuid, boolean) from public, anon;
grant execute on function public.set_member_is_child(uuid, boolean) to authenticated;

-- The functions below bypass Row Level Security, so each now checks private.can_see_task(). They are as before
-- (20261009110000_private_tasks.sql) apart from that, complete_task() copying for_children, and update_task()
-- setting it. put_back_task() and undo_complete_task() only act on tasks the user picked up or marked done, and a
-- child never holds an adults-only task, so they stay as they are.

create or replace function public.complete_task(task_id uuid, completed_on date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  done public.tasks;
  next_id uuid;
begin
  if completed_on is null or completed_on not between current_date - 1 and current_date + 1 then
    raise exception 'A task can only be marked done today' using errcode = '22023';
  end if;
  -- The row lock makes a second, simultaneous completion find the task already done.
  update public.tasks t
    set completed_at = now(), completed_by = auth.uid()
    where t.id = complete_task.task_id
      and private.can_see_task(t)
      and t.completed_at is null
    returning * into done;
  if done.id is null then
    raise exception 'No open task with this id in your household' using errcode = 'P0002';
  end if;
  if done.repeat_every_days is not null then
    insert into public.tasks
      (household_id, title, description, type, points, created_by, repeat_every_days, due_on,
       previous_task_id, is_private, for_children)
    values
      (done.household_id, done.title, done.description, done.type, done.points, done.created_by,
       done.repeat_every_days, completed_on + done.repeat_every_days, done.id, done.is_private,
       done.for_children)
    returning id into next_id;
  end if;
  return next_id;
end;
$$;

create or replace function public.pick_up_task(task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  task public.tasks;
begin
  -- Locks the row, so two members picking up at once can't both get it.
  select * into task from public.tasks t
    where t.id = pick_up_task.task_id
      and private.can_see_task(t)
      and t.completed_at is null
    for update;
  if task.id is null then
    raise exception 'No open task with this id in your household' using errcode = 'P0002';
  end if;
  if task.picked_up_by = auth.uid() then
    return;
  end if;
  if task.picked_up_at is not null then
    raise exception 'Someone else has picked up this task' using errcode = '55006';
  end if;
  update public.tasks t set picked_up_by = auth.uid(), picked_up_at = now() where t.id = task.id;
end;
$$;

create or replace function public.delete_task(task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.tasks t
    where t.id = delete_task.task_id
      and private.can_see_task(t)
      and t.completed_at is null;
  if not found then
    raise exception 'No open task with this id in your household' using errcode = 'P0002';
  end if;
end;
$$;

-- update_task() gains for_children, so it is replaced rather than overloaded. It is optional, so an app that doesn't
-- send it yet keeps the task's value.
drop function public.update_task(uuid, text, text, text, smallint, date, smallint);

-- Replaces an open task's details; task_for_children null keeps whether it is available for children. Raises
-- no_data_found (P0002) if the user can't see it open in their household, and insufficient_privilege (42501) if a
-- child makes it adults-only; the table's check constraints validate the values. Making a task adults-only takes it
-- back from a child who picked it up.
create function public.update_task(
  task_id uuid,
  task_title text,
  task_description text,
  task_type text,
  task_points smallint,
  task_due_on date,
  task_repeat_every_days smallint,
  task_for_children boolean default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  picker uuid;
begin
  if task_for_children is false and private.is_child(auth.uid()) then
    raise exception 'Only adults can make a task adults-only' using errcode = '42501';
  end if;
  update public.tasks t
    set title = task_title, description = task_description, type = task_type, points = task_points,
        due_on = task_due_on, repeat_every_days = task_repeat_every_days,
        for_children = coalesce(task_for_children, t.for_children)
    where t.id = update_task.task_id
      and private.can_see_task(t)
      and t.completed_at is null
    returning t.picked_up_by into picker;
  if not found then
    raise exception 'No open task with this id in your household' using errcode = 'P0002';
  end if;
  if task_for_children is false and private.is_child(picker) then
    perform private.put_back_adults_tasks(picker);
  end if;
end;
$$;

revoke execute on function public.update_task(uuid, text, text, text, smallint, date, smallint, boolean)
  from public, anon;
grant execute on function public.update_task(uuid, text, text, text, smallint, date, smallint, boolean)
  to authenticated;

-- task_suggestions() as before (20261010130000_favourite_tasks.sql), also returning for_children so adding a task
-- again keeps who it is for. It is security invoker, so a child is only offered tasks available for children.
drop function public.task_suggestions();
create function public.task_suggestions()
returns table (
  title text,
  description text,
  type text,
  points smallint,
  repeat_every_days smallint,
  is_private boolean,
  for_children boolean,
  times_added integer,
  is_open boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with household_tasks as (
    select t.*, lower(t.title) as title_key from public.tasks t
    where t.household_id = (select private.current_household_id())
  ),
  newest as (
    select distinct on (h.title_key) h.* from household_tasks h order by h.title_key, h.created_at desc, h.id
  ),
  usage as (
    select
      h.title_key,
      count(*) filter (where h.previous_task_id is null)::integer as times_added,
      max(h.created_at) filter (where h.previous_task_id is null) as last_added_at,
      bool_or(h.completed_at is null) as is_open
    from household_tasks h
    group by h.title_key
  ),
  ranked as (
    select
      n.title, n.description, n.type, n.points, n.repeat_every_days, n.is_private, n.for_children, u.times_added,
      u.is_open,
      row_number() over (order by u.times_added desc, u.last_added_at desc nulls last, n.title) as rank,
      exists (
        select 1 from public.favourite_tasks f
        where f.household_id = n.household_id and f.title_key = btrim(n.title_key)
      ) as is_favourite
    from newest n
    join usage u using (title_key)
  )
  select
    r.title, r.description, r.type, r.points, r.repeat_every_days, r.is_private, r.for_children, r.times_added,
    r.is_open
  from ranked r
  where r.rank <= 50 or r.is_favourite
  order by r.rank;
$$;

revoke execute on function public.task_suggestions() from public, anon;
grant execute on function public.task_suggestions() to authenticated;
