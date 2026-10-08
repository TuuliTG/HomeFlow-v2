-- Fixing mistakes (ADR 0004): any member can edit or delete an open task in their household, and whoever marked a
-- task done can undo it for an hour. Members still can't change tasks directly.

-- Replaces an open task's details. Raises no_data_found (P0002) if it isn't open in the user's household; the
-- table's check constraints validate the values.
create function public.update_task(
  task_id uuid,
  task_title text,
  task_type text,
  task_points smallint,
  task_due_on date,
  task_repeat_every_days smallint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tasks t
    set title = task_title, type = task_type, points = task_points, due_on = task_due_on,
        repeat_every_days = task_repeat_every_days
    where t.id = update_task.task_id
      and t.household_id = (select private.current_household_id())
      and t.completed_at is null;
  if not found then
    raise exception 'No open task with this id in your household' using errcode = 'P0002';
  end if;
end;
$$;

-- Deletes an open task. Done tasks stay as history. Raises no_data_found (P0002) if it isn't open in the user's
-- household.
create function public.delete_task(task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.tasks t
    where t.id = delete_task.task_id
      and t.household_id = (select private.current_household_id())
      and t.completed_at is null;
  if not found then
    raise exception 'No open task with this id in your household' using errcode = 'P0002';
  end if;
end;
$$;

-- Reopens a task the user marked done in the last hour and removes the next occurrence it created. Raises
-- no_data_found (P0002) if there is no such task, and object_in_use (55006) if its next occurrence is already
-- done.
create function public.undo_complete_task(task_id uuid)
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
      and t.household_id = (select private.current_household_id())
      and t.completed_by = auth.uid()
      and t.completed_at > now() - interval '1 hour'
    for update;
  if done.id is null then
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

revoke execute on function
  public.update_task(uuid, text, text, smallint, date, smallint),
  public.delete_task(uuid),
  public.undo_complete_task(uuid)
  from public, anon;
grant execute on function
  public.update_task(uuid, text, text, smallint, date, smallint),
  public.delete_task(uuid),
  public.undo_complete_task(uuid)
  to authenticated;
