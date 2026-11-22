-- A private task can be made shared when it is edited, by whoever added it (only they can see it); a shared task
-- can't be made private, since others may have seen it. An adult's becomes an adults' task, open to anyone: their
-- reminder and plan for it go unless they picked it up. A child's is given to them, as a child's new shared task is
-- (20261123120000_childrens_tasks_given_to_a_child.sql), and only while they may add tasks.
--
-- update_task() gains task_is_private, so it is replaced rather than overloaded. Null, as from an app that doesn't
-- send it yet, keeps it as it was. Otherwise as before (20261124120000_always_available_routines.sql).
drop function public.update_task(
  uuid, text, text, text, smallint, date, smallint, boolean, text, uuid, boolean, text[], text[], boolean, boolean,
  smallint
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
  task_daily_limit smallint default null,
  task_is_private boolean default null
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
  was_private boolean;
  -- Only a private task can be made shared: a shared task stays shared.
  shares boolean;
  picker uuid;
begin
  select t.is_private into was_private from public.tasks t
    where t.id = update_task.task_id and private.can_change_task(t)
    for update;
  shares := coalesce(was_private, false) and task_is_private is false;
  if shares and is_child and not private.can_add_tasks(auth.uid()) then
    raise exception 'Only children allowed to add tasks can share one' using errcode = '42501';
  end if;
  if task_for_children is false and is_child then
    raise exception 'Only adults can make a task adults-only' using errcode = '42501';
  end if;
  if changes_assignee and task_assigned_to is not null
    and not private.is_child_in_household(task_assigned_to, private.current_household_id()) then
    raise exception 'No child with this id in your household' using errcode = 'P0002';
  end if;
  update public.tasks t
    set title = task_title, description = task_description, type = task_type,
        points = case when is_child or (t.is_private and not shares) then null else task_points end,
        due_on = task_due_on, repeat_every_days = task_repeat_every_days,
        -- An adult's private task made shared is for the adults, even one added while they were a child.
        for_children = case when shares and not is_child then false
          else coalesce(task_for_children, t.for_children) end,
        icon = task_icon,
        assigned_to = case
          when shares and not is_child then null
          when not coalesce(task_for_children, t.for_children) then null
          when changes_assignee then task_assigned_to
          -- A child's private task made shared becomes theirs to do, like a child's new shared task.
          when shares and t.assigned_to is null then t.created_by
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
        end,
        is_private = t.is_private and not shares
    where t.id = update_task.task_id
      and private.can_change_task(t)
      and t.completed_at is null
      and (is_child or (t.is_private and not shares) or task_points is not null)
    returning t.picked_up_by into picker;
  if not found then
    raise exception 'No open task with this id in your household' using errcode = 'P0002';
  end if;
  if task_for_children is false and private.is_child(picker) then
    perform private.put_back_adults_tasks(picker);
  end if;
  -- No longer theirs to do unless they picked it up, so their reminder and plan go, as when putting a task back.
  if shares and not is_child and picker is distinct from auth.uid() then
    delete from public.task_reminders r where r.task_id = update_task.task_id and r.user_id = auth.uid();
    delete from public.task_schedules s where s.task_id = update_task.task_id and s.user_id = auth.uid();
  end if;
end;
$$;

revoke execute on function public.update_task(
  uuid, text, text, text, smallint, date, smallint, boolean, text, uuid, boolean, text[], text[], boolean, boolean,
  smallint, boolean
) from public, anon;
grant execute on function public.update_task(
  uuid, text, text, text, smallint, date, smallint, boolean, text, uuid, boolean, text[], text[], boolean, boolean,
  smallint, boolean
) to authenticated;

-- As before (20261123120000_childrens_tasks_given_to_a_child.sql), but a private task whose next occurrence was made
-- shared can't be undone: that would hide again a task others may have seen, picked up or been asked to do.
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
  ) or (
    done.for_children and not done.is_private and done.assigned_to is null
    and not private.is_child_in_household(done.completed_by, done.household_id)
  ) then
    raise exception 'You have not marked this task done in the last hour' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.tasks t where t.previous_task_id = done.id and t.completed_at is not null
  ) then
    raise exception 'The next occurrence of this task is already done' using errcode = '55006';
  end if;
  if exists (
    select 1 from public.tasks t where t.previous_task_id = done.id and t.is_private <> done.is_private
  ) then
    raise exception 'The next occurrence of this task has been made shared' using errcode = '55006';
  end if;
  delete from public.tasks t where t.previous_task_id = done.id;
  delete from public.task_helpers h where h.task_id = done.id;
  update public.tasks t
    set completed_at = null, completed_by = null,
        assigned_to = case
          when t.for_children and not t.is_private then coalesce(t.assigned_to, done.completed_by)
          else t.assigned_to
        end
    where t.id = done.id;
end;
$$;
