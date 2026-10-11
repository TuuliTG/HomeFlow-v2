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
-- for children if they are a child. The security definer functions acting on a task use it. The select policy spells
-- the same rule out instead: a function with SET isn't inlined, so in a policy it would run for every row of every
-- household rather than letting the household index narrow the rows first.
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
  using (
    household_id = (select private.current_household_id())
    and (not is_private or created_by = (select auth.uid()))
    and (for_children or not (select private.is_child((select auth.uid()))))
  );

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
  -- Locking the adult's own row means two adults marking each other at once can't both succeed and leave the
  -- household without an adult: the second waits, then finds itself a child (or the two deadlock and one fails).
  perform 1 from public.household_members m where m.user_id = auth.uid() and not m.is_child for share;
  if not found then
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
-- (20261009110000_private_tasks.sql, 20261008200000_edit_delete_undo_tasks.sql, 20261009140000_task_reminders.sql)
-- apart from that, complete_task() copying for_children, and update_task() setting it. put_back_task() only gives
-- back a task, so it stays as it is.

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

-- A child can undo only a task they can still see, and not when that would delete a next occurrence an adult has
-- since made adults-only. Otherwise as before (20261008200000_edit_delete_undo_tasks.sql).
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
  update public.tasks t set completed_at = null, completed_by = null where t.id = done.id;
end;
$$;

-- As before (20261009140000_task_reminders.sql), for a task the user can see.
create or replace function public.set_task_reminder(task_id uuid, remind_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if remind_at is null or remind_at < now() - interval '1 minute' or remind_at > now() + interval '1 year' then
    raise exception 'A reminder must be within the next year' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.tasks t
      where t.id = set_task_reminder.task_id
        and private.can_see_task(t)
        and private.is_task_to_do_by(t, auth.uid())
  ) then
    raise exception 'No open task of yours with this id' using errcode = 'P0002';
  end if;
  insert into public.task_reminders (task_id, user_id, remind_at)
  values (set_task_reminder.task_id, auth.uid(), set_task_reminder.remind_at)
  on conflict on constraint task_reminders_pkey do update set remind_at = excluded.remind_at;
end;
$$;

-- As before (20261009140000_task_reminders.sql), and never sends a child the title of an adults-only task.
create or replace function public.take_due_reminders()
returns table (user_id uuid, task_title text)
language sql
security definer
set search_path = ''
as $$
  with due as (
    delete from public.task_reminders r where r.remind_at <= now()
      returning r.task_id, r.user_id, r.remind_at
  )
  select due.user_id, t.title
    from due join public.tasks t on t.id = due.task_id
    where private.is_task_to_do_by(t, due.user_id) and due.remind_at > now() - interval '1 hour'
      and (t.for_children or not private.is_child(due.user_id));
$$;

-- Statistics and goals count every shared task, also for a child who can't see some of them: the family's fairness
-- and progress are the same for everyone. They return only numbers and names, never task titles, and stay scoped to
-- the caller's household (household_statistics() by current_household_id(), the goal helpers by a goal row the
-- caller could read or claim_goal_reward() chose).
alter function public.household_statistics(timestamptz) security definer;
alter function private.goal_points(public.goals) security definer;
alter function private.goal_member_points(public.goals) security definer;
