-- What children may do (ADR 0003, ADR 0004, ADR 0007). Adults add tasks; a child adds tasks only when an adult lets
-- them (can_add_tasks). A child's shared tasks have no points until an adult awards them, so a child can't choose
-- their own reward: they add a task, do it, and an adult decides what it was worth. Only adults add and delete goals,
-- also personal goals for a child.

alter table public.household_members add column can_add_tasks boolean not null default false;

-- Whether the user is an adult or a child an adult lets add tasks. Security definer like is_child(), for policies.
create function private.can_add_tasks(member uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select not m.is_child or m.can_add_tasks from public.household_members m where m.user_id = member),
    false
  );
$$;
revoke execute on function private.can_add_tasks(uuid) from public;
grant execute on function private.can_add_tasks(uuid) to authenticated;

-- Lets a child in the adult's household add tasks, or stops them. Raises insufficient_privilege (42501) for a child
-- and no_data_found (P0002) for anyone but a child in the adult's household. adult_household_id() locks the adult's
-- membership, so they can't be made a child halfway through.
create function public.set_member_can_add_tasks(member_id uuid, can_add_tasks boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  household uuid := private.adult_household_id(auth.uid());
begin
  if household is null then
    raise exception 'Only an adult in the household can change what a child may do' using errcode = '42501';
  end if;
  if can_add_tasks is null then
    raise exception 'Choose whether the child may add tasks' using errcode = '22023';
  end if;
  update public.household_members m set can_add_tasks = set_member_can_add_tasks.can_add_tasks
    where m.user_id = set_member_can_add_tasks.member_id and m.household_id = household and m.is_child;
  if not found then
    raise exception 'No child with this id in your household' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.set_member_can_add_tasks(uuid, boolean) from public, anon;
grant execute on function public.set_member_can_add_tasks(uuid, boolean) to authenticated;

-- A shared task may now be without points while it waits for an adult to award them; a private task still never has
-- any. Adults' shared tasks always have points (the insert policy and update_task() see to that).
alter table public.tasks
  drop constraint tasks_points_only_shared,
  add constraint tasks_private_without_points check (not is_private or points is null);

drop policy "Members can add tasks to their household" on public.tasks;
create policy "Adults and permitted children can add tasks to their household"
  on public.tasks for insert to authenticated
  with check (
    household_id = (select private.current_household_id())
    and created_by = (select auth.uid())
    and case
      when (select private.is_child((select auth.uid()))) then
        (select private.can_add_tasks((select auth.uid()))) and for_children and points is null
      else is_private or points is not null
    end
  );

-- Awards the points of a child's shared task, open or done, that is waiting for them. Raises insufficient_privilege
-- (42501) for a child and no_data_found (P0002) unless the task is a shared one in the adult's household without
-- points; the check constraint keeps them between 1 and 10.
create function public.award_task_points(task_id uuid, points smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.adult_household_id(auth.uid()) is null then
    raise exception 'Only an adult in the household can award points' using errcode = '42501';
  end if;
  if points is null then
    raise exception 'Choose the points to award' using errcode = '22023';
  end if;
  update public.tasks t set points = award_task_points.points
    where t.id = award_task_points.task_id
      and private.can_see_task(t)
      and not t.is_private
      and t.points is null;
  if not found then
    raise exception 'No task waiting for points with this id in your household' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.award_task_points(uuid, smallint) from public, anon;
grant execute on function public.award_task_points(uuid, smallint) to authenticated;

-- Whether the user may edit or delete the task: one they can see, and for a child only one they added.
create function private.can_change_task(task public.tasks)
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.can_see_task(task)
    and (not (select private.is_child((select auth.uid())))
      or task.created_by = (select auth.uid()));
$$;
revoke execute on function private.can_change_task(public.tasks) from public;
grant execute on function private.can_change_task(public.tasks) to authenticated;

-- As before (20261011100000_children.sql), but a child edits only tasks they added, and their edit sends a shared
-- task back to waiting for points, so points an adult awarded can't carry over to a different task. An adult can't
-- take a shared task's points away.
create or replace function public.update_task(
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
  is_child boolean := private.is_child(auth.uid());
  picker uuid;
begin
  if task_for_children is false and is_child then
    raise exception 'Only adults can make a task adults-only' using errcode = '42501';
  end if;
  update public.tasks t
    set title = task_title, description = task_description, type = task_type,
        points = case when is_child then null else task_points end,
        due_on = task_due_on, repeat_every_days = task_repeat_every_days,
        for_children = coalesce(task_for_children, t.for_children)
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

-- As before (20261011100000_children.sql), but a child deletes only tasks they added.
create or replace function public.delete_task(task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.tasks t
    where t.id = delete_task.task_id
      and private.can_change_task(t)
      and t.completed_at is null;
  if not found then
    raise exception 'No open task with this id in your household' using errcode = 'P0002';
  end if;
end;
$$;

-- As before (20261011100000_children.sql), but the next occurrence of a child's shared task waits for points again,
-- so points awarded once don't repeat by themselves.
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
      (done.household_id, done.title, done.description, done.type,
       case when private.is_child(done.created_by) then null else done.points end, done.created_by,
       done.repeat_every_days, completed_on + done.repeat_every_days, done.id, done.is_private,
       done.for_children)
    returning id into next_id;
  end if;
  return next_id;
end;
$$;

-- Goals: only adults add and delete them. An adult can set a personal goal for anyone in the household, a child
-- included; its owner still claims it (claim_goal_reward()).
drop policy "Members can add shared goals and their own personal ones" on public.goals;
create policy "Adults can add shared goals and personal ones for their household"
  on public.goals for insert to authenticated
  with check (
    household_id = (select private.current_household_id())
    and created_by = (select auth.uid())
    and not (select private.is_child((select auth.uid())))
    and (
      owner_id is null
      or exists (
        select 1 from public.household_members m
          where m.user_id = goals.owner_id and m.household_id = (select private.current_household_id())
      )
    )
  );

drop policy "Members can delete open shared goals and their own personal ones" on public.goals;
create policy "Adults can delete open goals"
  on public.goals for delete to authenticated
  using (
    household_id = (select private.current_household_id())
    and not (select private.is_child((select auth.uid())))
    and claimed_at is null
  );
