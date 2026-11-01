-- Chores for one child (ADR 0004). An adult can give a task for children to one child in the household: it is
-- picked up for them straight away, so it shows on their Me page, and it is theirs alone: they can't put it back or
-- hand it over, and the other children don't see it. Adults still see it on the board, and can change or clear who
-- it is for by editing the task.
alter table public.tasks
  add column assigned_to uuid references auth.users (id) on delete set null,
  add constraint tasks_assigned_only_for_children
    check (assigned_to is null or (for_children and not is_private));

grant insert (assigned_to) on table public.tasks to authenticated;

-- Whether the member is a child in the household. Security definer like is_child(), for policies.
create function private.is_child_in_household(member uuid, household uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
      where m.user_id = member and m.household_id = household and m.is_child
  );
$$;
revoke execute on function private.is_child_in_household(uuid, uuid) from public;
grant execute on function private.is_child_in_household(uuid, uuid) to authenticated;

-- A task given to a child is picked up for them, also taking it from whoever had it. A child it is no longer given
-- to gives it back; a child who has become an adult keeps it picked up. The triggers below then settle requests and
-- schedules as for any change of hands.
create function private.pick_up_for_assignee()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.assigned_to is not distinct from old.assigned_to then
    return new;
  end if;
  if new.assigned_to is not null then
    new.picked_up_by := new.assigned_to;
    new.picked_up_at := now();
  elsif tg_op = 'UPDATE' and new.picked_up_by = old.assigned_to
    and private.is_child_in_household(old.assigned_to, new.household_id) then
    new.picked_up_by := null;
    new.picked_up_at := null;
  end if;
  return new;
end;
$$;
revoke execute on function private.pick_up_for_assignee() from public;

create trigger tasks_pick_up_for_assignee
  before insert or update of assigned_to on public.tasks
  for each row
  execute function private.pick_up_for_assignee();

-- As before (20261018120000_task_requests.sql), and giving a task to a child also settles its request, even when
-- the child already had it: nobody else can be asked to do it any more.
create or replace function private.settle_task_requests()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.task_requests r
    where r.task_id = new.id
      and (
        new.completed_at is not null
        or new.assigned_to is not null
        or (new.picked_up_by is not null and r.requested_for <> new.picked_up_by)
        or (r.answer = 'accepted' and r.requested_for is distinct from new.picked_up_by)
      );
  update public.task_requests r set answer = 'accepted', answered_at = now()
    where r.task_id = new.id and r.requested_for = new.picked_up_by and r.answer is null;
  return null;
end;
$$;

-- An UPDATE OF trigger fires only for the columns the statement sets, not those a BEFORE trigger changes, so the
-- triggers that follow a change of hands also fire on assigned_to, which is how the task changes hands then.
drop trigger tasks_settle_task_requests on public.tasks;
create trigger tasks_settle_task_requests
  after update of picked_up_by, completed_at, assigned_to on public.tasks
  for each row
  when (
    (old.completed_at is null and new.completed_at is not null)
    or old.picked_up_by is distinct from new.picked_up_by
    or (new.assigned_to is not null and old.assigned_to is distinct from new.assigned_to)
  )
  execute function private.settle_task_requests();

drop trigger tasks_clear_schedule_of_previous_picker on public.tasks;
create trigger tasks_clear_schedule_of_previous_picker
  after update of picked_up_by, assigned_to on public.tasks
  for each row
  when (old.picked_up_by is not null and old.picked_up_by is distinct from new.picked_up_by)
  execute function private.clear_schedule_of_previous_picker();

-- Only children are given tasks, so a child who becomes an adult no longer is; they keep the open ones picked up.
-- Done ones are cleared too, so undoing one can't reopen a task given to an adult.
create function private.clear_assignments_of_new_adult()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tasks t set assigned_to = null where t.assigned_to = new.user_id;
  return null;
end;
$$;
revoke execute on function private.clear_assignments_of_new_adult() from public;

create trigger household_members_clear_assignments_of_new_adult
  after update of is_child on public.household_members
  for each row
  when (old.is_child and not new.is_child)
  execute function private.clear_assignments_of_new_adult();

-- As before (20261011100000_children.sql), but a child sees a task given to one child only if it is given to them.
create or replace function private.can_see_task(task public.tasks)
returns boolean
language sql
stable
set search_path = ''
as $$
  select task.household_id = (select private.current_household_id())
    and (not task.is_private or task.created_by = (select auth.uid()))
    and (
      (task.for_children and (task.assigned_to is null or task.assigned_to = (select auth.uid())))
      or not (select private.is_child((select auth.uid())))
    );
$$;

-- The same rule spelled out, as before (20261011100000_children.sql). Realtime applies it too.
drop policy "Members can view the tasks of their household they may see" on public.tasks;
create policy "Members can view the tasks of their household they may see"
  on public.tasks for select to authenticated
  using (
    household_id = (select private.current_household_id())
    and (not is_private or created_by = (select auth.uid()))
    and (
      (for_children and (assigned_to is null or assigned_to = (select auth.uid())))
      or not (select private.is_child((select auth.uid())))
    )
  );

-- As before (20261011140000_child_permissions.sql), and only an adult gives a task to a child, one in their household.
drop policy "Adults and permitted children can add tasks to their household" on public.tasks;
create policy "Adults and permitted children can add tasks to their household"
  on public.tasks for insert to authenticated
  with check (
    household_id = (select private.current_household_id())
    and created_by = (select auth.uid())
    and case
      when (select private.is_child((select auth.uid()))) then
        (select private.can_add_tasks((select auth.uid()))) and for_children and points is null
        and assigned_to is null
      else (is_private or points is not null)
        and (assigned_to is null or private.is_child_in_household(assigned_to, household_id))
    end
  );

-- As before (20261009140000_task_reminders.sql), but a child can't give back a task given to them.
create or replace function public.put_back_task(task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tasks t set picked_up_by = null, picked_up_at = null
    where t.id = put_back_task.task_id
      and t.household_id = (select private.current_household_id())
      and t.completed_at is null
      and t.picked_up_by = auth.uid()
      and t.assigned_to is null;
  if not found then
    raise exception 'You have not picked up this open task' using errcode = 'P0002';
  end if;
  delete from public.task_reminders r where r.task_id = put_back_task.task_id and r.user_id = auth.uid();
end;
$$;

-- As before (20261018120000_task_requests.sql), but nobody can be asked to do a task given to a child: it is
-- theirs alone. Raises no_data_found (P0002) for one.
create or replace function public.request_task(task_id uuid, member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  task public.tasks;
begin
  if member_id is null or member_id = auth.uid() then
    raise exception 'Ask another member of your household' using errcode = '22023';
  end if;
  -- Locks the task, so it can't be picked up meanwhile.
  select * into task from public.tasks t
    where t.id = request_task.task_id
      and private.can_see_task(t)
      and t.completed_at is null
      and not t.is_private
      and t.assigned_to is null
    for update;
  if task.id is null then
    raise exception 'No open shared task with this id in your household' using errcode = 'P0002';
  end if;
  if task.picked_up_by is not null and task.picked_up_by <> auth.uid() then
    raise exception 'Someone else has picked up this task' using errcode = '55006';
  end if;
  if not exists (
    select 1 from public.household_members m
      where m.user_id = request_task.member_id
        and m.household_id = task.household_id
        and (task.for_children or not m.is_child)
  ) then
    raise exception 'No member with this id in your household can do this task' using errcode = 'P0002';
  end if;
  -- Deleted and added rather than updated, so the webhook sees a new request as an insert.
  delete from public.task_requests r where r.task_id = task.id;
  insert into public.task_requests (task_id, requested_by, requested_for)
    values (task.id, auth.uid(), request_task.member_id);
  -- Touches the task, so members' apps refresh it live (ADR 0004) and show the request.
  update public.tasks t set title = t.title where t.id = task.id;
end;
$$;

-- update_task() gains who the task is given to, so it is replaced rather than overloaded. An adult's edit with
-- task_change_assignee sets it (null: no one in particular); otherwise, as for a child or an app that doesn't send
-- it yet, it stays. Raises no_data_found (P0002) if it isn't a child in the household, and check_violation (23514)
-- for a task given to a child that isn't for children or is private. Otherwise as before
-- (20261020120000_task_icons.sql).
drop function public.update_task(uuid, text, text, text, smallint, date, smallint, boolean, text);
create function public.update_task(
  task_id uuid,
  task_title text,
  task_description text,
  task_type text,
  task_points smallint,
  task_due_on date,
  task_repeat_every_days smallint,
  task_for_children boolean default null,
  task_icon text default null,
  task_assigned_to uuid default null,
  task_change_assignee boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_child boolean := private.is_child(auth.uid());
  changes_assignee boolean := coalesce(task_change_assignee, false) and not is_child;
  picker uuid;
begin
  if task_for_children is false and is_child then
    raise exception 'Only adults can make a task adults-only' using errcode = '42501';
  end if;
  if changes_assignee and task_assigned_to is not null
    and not private.is_child_in_household(task_assigned_to, private.current_household_id()) then
    raise exception 'No child with this id in your household' using errcode = 'P0002';
  end if;
  update public.tasks t
    set title = task_title, description = task_description, type = task_type,
        points = case when is_child then null else task_points end,
        due_on = task_due_on, repeat_every_days = task_repeat_every_days,
        for_children = coalesce(task_for_children, t.for_children),
        icon = task_icon,
        assigned_to = case when changes_assignee then task_assigned_to else t.assigned_to end
    where t.id = update_task.task_id
      and private.can_change_task(t)
      and t.completed_at is null
      and (is_child or t.is_private or task_points is not null)
    returning t.picked_up_by into picker;
  if not found then
    raise exception 'No open task with this id in your household' using errcode = 'P0002';
  end if;
  if task_for_children is false and private.is_child(picker) then
    perform private.put_back_adults_tasks(picker);
  end if;
end;
$$;

revoke execute on function public.update_task(uuid, text, text, text, smallint, date, smallint, boolean, text, uuid, boolean)
  from public, anon;
grant execute on function public.update_task(uuid, text, text, text, smallint, date, smallint, boolean, text, uuid, boolean)
  to authenticated;

-- complete_task() as before (20261020120000_task_icons.sql), now giving the next occurrence to the same child, as
-- long as they are still a child in the household.
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
       previous_task_id, is_private, for_children, icon, assigned_to)
    values
      (done.household_id, done.title, done.description, done.type,
       case when private.is_child(done.created_by) then null else done.points end, done.created_by,
       done.repeat_every_days, completed_on + done.repeat_every_days, done.id, done.is_private,
       done.for_children, done.icon,
       case when private.is_child_in_household(done.assigned_to, done.household_id) then done.assigned_to end)
    returning id into next_id;
    insert into public.task_images (task_id, path, position)
      select next_id, i.path, i.position from public.task_images i where i.task_id = done.id;
  end if;
  return next_id;
end;
$$;
