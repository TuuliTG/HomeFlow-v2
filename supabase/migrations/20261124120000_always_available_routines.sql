-- Routines are always available (ADR 0004): no repeat and no due date. Marking one done adds a fresh copy straight
-- away, as for an always task, so anyone can do it again whenever it needs doing. The open routines lose their repeat
-- and due date, as do those done within the undo window, so undoing one reopens it as it is now; older done ones keep
-- theirs as history.
alter table public.tasks drop constraint tasks_routine_repeats;

update public.tasks set repeat_every_days = null, due_on = null
  where is_routine and (completed_at is null or completed_at > now() - interval '1 hour');

alter table public.tasks
  add constraint tasks_routine_always_available check (
    not is_routine or completed_at is not null or (repeat_every_days is null and due_on is null)
  );

-- As before (20261123120000_childrens_tasks_given_to_a_child.sql), but a routine stays one without a repeat.
create or replace function public.update_task(
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
        assigned_to = case
          when not coalesce(task_for_children, t.for_children) then null
          when changes_assignee then task_assigned_to
          else t.assigned_to
        end,
        labels = coalesce(task_labels, t.labels),
        custom_labels = coalesce(task_custom_labels, t.custom_labels),
        -- A task given a repeat or a due date stops being a routine.
        is_routine = coalesce(task_is_routine, t.is_routine)
          and task_repeat_every_days is null and task_due_on is null,
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

-- complete_task() as before (20261122120000_always_tasks.sql), and a routine is followed at once by a fresh copy,
-- without an always task's pause or daily limit.
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
       assigned_to, labels, custom_labels, is_always, daily_limit, times_done, times_done_on)
    values
      (done.household_id, done.title, done.description, done.type, done.points, done.created_by, done.id,
       done.for_children, done.icon,
       case when private.is_child_in_household(done.assigned_to, done.household_id) then done.assigned_to end,
       done.labels, done.custom_labels, true, done.daily_limit,
       case when done.times_done_on = completed_on then done.times_done + 1 else 1 end, completed_on)
    returning id into next_id;
  elsif done.is_routine or done.repeat_every_days is not null then
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

-- household_statistics() as before (20261122120000_always_tasks.sql), and the fresh copies of a routine don't count
-- as created either: they can come many times a day.
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
        and not ((t.is_always or t.is_routine) and t.previous_task_id is not null)
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
