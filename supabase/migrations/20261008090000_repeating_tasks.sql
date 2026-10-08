-- Due dates, marking tasks done and repeating tasks (ADR 0015). A repeating task gets its next
-- occurrence when it is done, due a set number of days after the day it was done: a late task pushes
-- the next one back instead of following a fixed calendar.
alter table public.tasks
  add column repeat_every_days smallint check (repeat_every_days between 1 and 365),
  add column due_on date,
  add column completed_at timestamptz,
  -- Kept when the member deletes their account, like created_by, so the history stays intact.
  add column completed_by uuid references auth.users (id) on delete set null,
  -- The occurrence this task repeats; null for a task someone added. Unique: one next occurrence each.
  add column previous_task_id uuid unique references public.tasks (id) on delete set null;

grant insert (repeat_every_days, due_on) on table public.tasks to authenticated;

-- Marks an open task in the user's household done and, if it repeats, adds its next occurrence. The
-- next one keeps the original creator, who planned the routine. `completed_on` is the user's local
-- date, which can differ from the server's by a day either way. Returns the next occurrence's id, or
-- null. Raises no_data_found (P0002) if the task isn't open in the user's household.
-- Members can't update tasks directly, so completion can only set these columns.
create function public.complete_task(task_id uuid, completed_on date)
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
      (household_id, title, type, points, created_by, repeat_every_days, due_on, previous_task_id)
    values
      (done.household_id, done.title, done.type, done.points, done.created_by,
       done.repeat_every_days, completed_on + done.repeat_every_days, done.id)
    returning id into next_id;
  end if;
  return next_id;
end;
$$;

revoke execute on function public.complete_task(uuid, date) from public, anon;
grant execute on function public.complete_task(uuid, date) to authenticated;
