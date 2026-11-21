-- Always tasks: a child's everyday chore, like brushing teeth, that is always on their Me page, without a due date
-- or a repeat (ADR 0004). Marking one done adds a fresh copy straight away, as a repeating task adds its next
-- occurrence, so every time it is done counts as before. The copy can be marked done again only after a short pause,
-- and at most `daily_limit` times a day (none for no limit).
alter table public.tasks
  add column is_always boolean not null default false,
  add column daily_limit smallint,
  -- How many times this chore was done on `times_done_on`, the doer's local date, before this copy was added.
  add column times_done smallint not null default 0,
  add column times_done_on date,
  add constraint tasks_always_for_children check (
    not is_always or (for_children and not is_private and repeat_every_days is null and due_on is null)
  ),
  add constraint tasks_daily_limit check (daily_limit is null or (is_always and daily_limit between 1 and 10));

grant insert (is_always, daily_limit) on table public.tasks to authenticated;

-- As before (20261024120000_assigned_tasks.sql), but only adults add always tasks.
drop policy "Adults and permitted children can add tasks to their household" on public.tasks;
create policy "Adults and permitted children can add tasks to their household"
  on public.tasks for insert to authenticated
  with check (
    household_id = (select private.current_household_id())
    and created_by = (select auth.uid())
    and case
      when (select private.is_child((select auth.uid()))) then
        (select private.can_add_tasks((select auth.uid()))) and for_children and points is null
        and assigned_to is null and not is_always
      else (is_private or points is not null)
        and (assigned_to is null or private.is_child_in_household(assigned_to, household_id))
    end
  );

-- update_task() gains is_always and daily_limit, so it is replaced rather than overloaded. An app that doesn't send
-- them yet, or a child's edit, keeps them as they were. Otherwise as before (20261114120000_routine_tasks.sql).
drop function public.update_task(
  uuid, text, text, text, smallint, date, smallint, boolean, text, uuid, boolean, text[], text[], boolean
);
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
  task_change_assignee boolean default false,
  task_labels text[] default null,
  task_custom_labels text[] default null,
  task_is_routine boolean default null,
  task_is_always boolean default null,
  task_daily_limit smallint default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_child boolean := private.is_child(auth.uid());
  changes_assignee boolean := coalesce(task_change_assignee, false) and not is_child;
  -- Null keeps whether it is an always task and its limit.
  sets_always boolean := case when is_child then null else task_is_always end;
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
        assigned_to = case when changes_assignee then task_assigned_to else t.assigned_to end,
        labels = coalesce(task_labels, t.labels),
        custom_labels = coalesce(task_custom_labels, t.custom_labels),
        -- Only a repeating task is a routine: one made one-off stops being one.
        is_routine = coalesce(task_is_routine, t.is_routine) and task_repeat_every_days is not null,
        is_always = coalesce(sets_always, t.is_always),
        daily_limit = case
          when sets_always is null then t.daily_limit
          when sets_always then task_daily_limit
        end
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

revoke execute on function public.update_task(
  uuid, text, text, text, smallint, date, smallint, boolean, text, uuid, boolean, text[], text[], boolean, boolean,
  smallint
) from public, anon;
grant execute on function public.update_task(
  uuid, text, text, text, smallint, date, smallint, boolean, text, uuid, boolean, text[], text[], boolean, boolean,
  smallint
) to authenticated;

-- complete_task() as before (20261114120000_routine_tasks.sql), and an always task is followed at once by a fresh
-- copy, once its pause since it was last done is over and while its daily limit allows.
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
  if done.is_always then
    -- Keeps the app's ALWAYS_TASK_PAUSE_MS.
    if exists (
      select 1 from public.tasks p
        where p.id = done.previous_task_id and p.completed_at > now() - interval '2 minutes'
    ) then
      raise exception 'This task was done a moment ago' using errcode = '55006';
    end if;
    if done.daily_limit is not null and done.times_done_on = completed_on
      and done.times_done >= done.daily_limit then
      raise exception 'This task has been done as often as it may be today' using errcode = '55006';
    end if;
    insert into public.tasks
      (household_id, title, description, type, points, created_by, previous_task_id, for_children, icon,
       assigned_to, is_always, daily_limit, times_done, times_done_on)
    values
      (done.household_id, done.title, done.description, done.type, done.points, done.created_by, done.id,
       done.for_children, done.icon,
       case when private.is_child_in_household(done.assigned_to, done.household_id) then done.assigned_to end,
       true, done.daily_limit,
       case when done.times_done_on = completed_on then done.times_done + 1 else 1 end, completed_on)
    returning id into next_id;
  elsif done.repeat_every_days is not null then
    insert into public.tasks
      (household_id, title, description, type, points, created_by, repeat_every_days, due_on,
       previous_task_id, is_private, for_children, icon, assigned_to, labels, custom_labels, is_routine)
    values
      (done.household_id, done.title, done.description, done.type,
       case when private.is_child(done.created_by) then null else done.points end, done.created_by,
       done.repeat_every_days, completed_on + done.repeat_every_days, done.id, done.is_private,
       done.for_children, done.icon,
       case when private.is_child_in_household(done.assigned_to, done.household_id) then done.assigned_to end,
       done.labels, done.custom_labels, done.is_routine)
    returning id into next_id;
  end if;
  if next_id is not null then
    insert into public.task_images (task_id, path, position)
      select next_id, i.path, i.position from public.task_images i where i.task_id = done.id;
  end if;
  return next_id;
end;
$$;
