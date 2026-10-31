-- Labels say what kind of chore a task is, e.g. Kitchen or Laundry, so statistics can later show how each kind of
-- work is shared (ADR 0004). A task can have several. `labels` holds the names of the app's ready-made labels,
-- which each member reads in their own language; like icons, only their format is checked, so the set can grow
-- without a migration. `custom_labels` holds the household's own labels as members typed them.
create function private.are_valid_task_labels(labels text[], custom_labels text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(labels) + cardinality(custom_labels) <= 10
    and array_position(labels, null) is null
    and array_position(custom_labels, null) is null
    and (select bool_and(l ~ '^[a-z][a-z0-9-]{0,39}$') and count(distinct l) = count(*) from unnest(labels) l)
      is not false
    and (
      select bool_and(c = btrim(c) and char_length(c) between 1 and 30)
        and count(distinct lower(c)) = count(*)
      from unnest(custom_labels) c
    ) is not false;
$$;
revoke execute on function private.are_valid_task_labels(text[], text[]) from public;
grant execute on function private.are_valid_task_labels(text[], text[]) to authenticated;

alter table public.tasks
  add column labels text[] not null default '{}',
  add column custom_labels text[] not null default '{}',
  add constraint tasks_valid_labels check (private.are_valid_task_labels(labels, custom_labels));

grant insert (labels, custom_labels) on table public.tasks to authenticated;

-- update_task() gains the labels, so it is replaced rather than overloaded. An app that doesn't send them yet
-- keeps them as they were. Otherwise as before (20261024120000_assigned_tasks.sql).
drop function public.update_task(uuid, text, text, text, smallint, date, smallint, boolean, text, uuid, boolean);
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
  task_custom_labels text[] default null
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
        assigned_to = case when changes_assignee then task_assigned_to else t.assigned_to end,
        labels = coalesce(task_labels, t.labels),
        custom_labels = coalesce(task_custom_labels, t.custom_labels)
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
  uuid, text, text, text, smallint, date, smallint, boolean, text, uuid, boolean, text[], text[]
) from public, anon;
grant execute on function public.update_task(
  uuid, text, text, text, smallint, date, smallint, boolean, text, uuid, boolean, text[], text[]
) to authenticated;

-- complete_task() as before (20261024120000_assigned_tasks.sql), now copying the labels to the next occurrence.
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
       previous_task_id, is_private, for_children, icon, assigned_to, labels, custom_labels)
    values
      (done.household_id, done.title, done.description, done.type,
       case when private.is_child(done.created_by) then null else done.points end, done.created_by,
       done.repeat_every_days, completed_on + done.repeat_every_days, done.id, done.is_private,
       done.for_children, done.icon,
       case when private.is_child_in_household(done.assigned_to, done.household_id) then done.assigned_to end,
       done.labels, done.custom_labels)
    returning id into next_id;
    insert into public.task_images (task_id, path, position)
      select next_id, i.path, i.position from public.task_images i where i.task_id = done.id;
  end if;
  return next_id;
end;
$$;

-- task_suggestions() as before (20261020120000_task_icons.sql), also returning the labels so adding a task again
-- keeps them.
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
  icon text,
  labels text[],
  custom_labels text[],
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
      n.title, n.description, n.type, n.points, n.repeat_every_days, n.is_private, n.for_children, n.icon,
      n.labels, n.custom_labels, u.times_added, u.is_open,
      row_number() over (order by u.times_added desc, u.last_added_at desc nulls last, n.title) as rank,
      exists (
        select 1 from public.favourite_tasks f
        where f.household_id = n.household_id and f.title_key = btrim(n.title_key)
      ) as is_favourite
    from newest n
    join usage u using (title_key)
  )
  select
    r.title, r.description, r.type, r.points, r.repeat_every_days, r.is_private, r.for_children, r.icon,
    r.labels, r.custom_labels, r.times_added, r.is_open
  from ranked r
  where r.rank <= 50 or r.is_favourite
  order by r.rank;
$$;

revoke execute on function public.task_suggestions() from public, anon;
grant execute on function public.task_suggestions() to authenticated;

-- The household's own labels, offered on the task form: one per label ignoring case, as most recently spelled,
-- most used first. Security invoker, so RLS leaves out labels only other members' private tasks have.
create function public.custom_task_labels()
returns table (label text)
language sql
stable
security invoker
set search_path = ''
as $$
  with used as (
    select l.label, lower(l.label) as label_key, t.created_at
    from public.tasks t
    cross join lateral unnest(t.custom_labels) as l (label)
    where t.household_id = (select private.current_household_id())
  ),
  spelled as (
    select distinct on (u.label_key) u.label_key, u.label from used u order by u.label_key, u.created_at desc, u.label
  ),
  counted as (
    select u.label_key, count(*) as uses from used u group by u.label_key
  )
  select s.label from spelled s join counted c using (label_key) order by c.uses desc, s.label limit 100;
$$;

revoke execute on function public.custom_task_labels() from public, anon;
grant execute on function public.custom_task_labels() to authenticated;
