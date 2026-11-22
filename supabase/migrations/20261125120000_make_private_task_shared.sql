-- A private task can be made shared when it is edited, by whoever added it (only they can see it); a shared task
-- can't be made private, since others may have seen it. A child's task made shared is given to them, as a child's new
-- shared task is (20261123120000_childrens_tasks_given_to_a_child.sql).
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
  -- Only false changes anything: a shared task stays shared.
  makes_shared boolean := task_is_private is false;
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
        points = case when is_child or (t.is_private and not makes_shared) then null else task_points end,
        due_on = task_due_on, repeat_every_days = task_repeat_every_days,
        for_children = coalesce(task_for_children, t.for_children),
        icon = task_icon,
        assigned_to = case
          when not coalesce(task_for_children, t.for_children) then null
          when changes_assignee then task_assigned_to
          -- A child's private task made shared becomes theirs to do, like a child's new shared task.
          when t.is_private and makes_shared and t.assigned_to is null and is_child then t.created_by
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
        is_private = t.is_private and not makes_shared
    where t.id = update_task.task_id
      and private.can_change_task(t)
      and t.completed_at is null
      and (is_child or (t.is_private and not makes_shared) or task_points is not null)
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
  smallint, boolean
) from public, anon;
grant execute on function public.update_task(
  uuid, text, text, text, smallint, date, smallint, boolean, text, uuid, boolean, text[], text[], boolean, boolean,
  smallint, boolean
) to authenticated;
