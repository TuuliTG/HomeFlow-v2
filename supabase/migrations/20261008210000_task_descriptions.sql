-- An optional description for tasks that need more explanation (ADR 0004).
alter table public.tasks
  add column description text
    check (char_length(description) between 1 and 500 and description = btrim(description));

grant insert (description) on table public.tasks to authenticated;

-- update_task() gains the description, so it is replaced rather than overloaded.
drop function public.update_task(uuid, text, text, smallint, date, smallint);

-- Replaces an open task's details. Raises no_data_found (P0002) if it isn't open in the user's household; the
-- table's check constraints validate the values.
create function public.update_task(
  task_id uuid,
  task_title text,
  task_description text,
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
    set title = task_title, description = task_description, type = task_type, points = task_points,
        due_on = task_due_on, repeat_every_days = task_repeat_every_days
    where t.id = update_task.task_id
      and t.household_id = (select private.current_household_id())
      and t.completed_at is null;
  if not found then
    raise exception 'No open task with this id in your household' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.update_task(uuid, text, text, text, smallint, date, smallint)
  from public, anon;
grant execute on function public.update_task(uuid, text, text, text, smallint, date, smallint)
  to authenticated;

-- complete_task() as before (20261008090000_repeating_tasks.sql), now copying the description to the next
-- occurrence.
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
      and t.household_id = (select private.current_household_id())
      and t.completed_at is null
    returning * into done;
  if done.id is null then
    raise exception 'No open task with this id in your household' using errcode = 'P0002';
  end if;
  if done.repeat_every_days is not null then
    insert into public.tasks
      (household_id, title, description, type, points, created_by, repeat_every_days, due_on,
       previous_task_id)
    values
      (done.household_id, done.title, done.description, done.type, done.points, done.created_by,
       done.repeat_every_days, completed_on + done.repeat_every_days, done.id)
    returning id into next_id;
  end if;
  return next_id;
end;
$$;
