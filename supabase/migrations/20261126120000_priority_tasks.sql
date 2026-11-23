-- An adults' shared task can be marked a priority, which the board lists at the top (ADR 0004). Marking one done
-- doesn't make its next occurrence a priority: complete_task() doesn't copy it, so a repeating task's flag goes once
-- it is done.
alter table public.tasks
  add column is_priority boolean not null default false,
  add constraint tasks_priority_adults_shared
    check (not is_priority or (not is_private and not for_children and not is_routine));

grant insert (is_priority) on table public.tasks to authenticated;

-- update_task() gains task_is_priority, so it is replaced rather than overloaded. Null, as from an app that doesn't
-- send it yet, keeps it as it was. Otherwise as before (20261125120000_make_private_task_shared.sql).
drop function public.update_task(
  uuid, text, text, text, smallint, date, smallint, boolean, text, uuid, boolean, text[], text[], boolean, boolean,
  smallint, boolean
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
  task_is_private boolean default null,
  task_is_priority boolean default null
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
        is_private = t.is_private and not shares,
        -- Only the adults' shared tasks can be a priority: one made a task for children or a routine stops being one.
        is_priority = coalesce(task_is_priority, t.is_priority)
          and not (case when shares and not is_child then false else coalesce(task_for_children, t.for_children) end)
          and not (t.is_private and not shares)
          and not (coalesce(task_is_routine, t.is_routine) and task_repeat_every_days is null and task_due_on is null)
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
  smallint, boolean, boolean
) from public, anon;
grant execute on function public.update_task(
  uuid, text, text, text, smallint, date, smallint, boolean, text, uuid, boolean, text[], text[], boolean, boolean,
  smallint, boolean, boolean
) to authenticated;

