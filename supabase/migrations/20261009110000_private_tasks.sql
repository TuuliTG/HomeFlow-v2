-- Private tasks (ADR 0004): a member can add a task only they can see, not shared with the family. Whether a task
-- is private is chosen when adding it and doesn't change; the next occurrence of a repeating task keeps it.
alter table public.tasks add column is_private boolean not null default false;

grant insert (is_private) on table public.tasks to authenticated;

-- Realtime applies this policy too, so other members aren't sent private tasks live either.
drop policy "Members can view their household's tasks" on public.tasks;
create policy "Members can view their household's shared tasks and their own private ones"
  on public.tasks for select to authenticated
  using (
    household_id = (select private.current_household_id())
    and (not is_private or created_by = (select auth.uid()))
  );

-- The functions below bypass Row Level Security, so each one also skips other members' private tasks. They are as
-- before (20261008190000_pick_up_tasks.sql, 20261008210000_task_descriptions.sql,
-- 20261008200000_edit_delete_undo_tasks.sql) apart from that, and complete_task() copying is_private.
-- put_back_task() and undo_complete_task() only act on tasks the user picked up or marked done, which they could
-- see, so they stay as they are.

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
      and (not t.is_private or t.created_by = auth.uid())
      and t.completed_at is null
    returning * into done;
  if done.id is null then
    raise exception 'No open task with this id in your household' using errcode = 'P0002';
  end if;
  if done.repeat_every_days is not null then
    insert into public.tasks
      (household_id, title, description, type, points, created_by, repeat_every_days, due_on,
       previous_task_id, is_private)
    values
      (done.household_id, done.title, done.description, done.type, done.points, done.created_by,
       done.repeat_every_days, completed_on + done.repeat_every_days, done.id, done.is_private)
    returning id into next_id;
  end if;
  return next_id;
end;
$$;

create or replace function public.pick_up_task(task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  task public.tasks;
begin
  -- Locks the row, so two members picking up at once can't both get it.
  select * into task from public.tasks t
    where t.id = pick_up_task.task_id
      and t.household_id = (select private.current_household_id())
      and (not t.is_private or t.created_by = auth.uid())
      and t.completed_at is null
    for update;
  if task.id is null then
    raise exception 'No open task with this id in your household' using errcode = 'P0002';
  end if;
  if task.picked_up_by = auth.uid() then
    return;
  end if;
  if task.picked_up_at is not null then
    raise exception 'Someone else has picked up this task' using errcode = '55006';
  end if;
  update public.tasks t set picked_up_by = auth.uid(), picked_up_at = now() where t.id = task.id;
end;
$$;

create or replace function public.update_task(
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
      and (not t.is_private or t.created_by = auth.uid())
      and t.completed_at is null;
  if not found then
    raise exception 'No open task with this id in your household' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.delete_task(task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.tasks t
    where t.id = delete_task.task_id
      and t.household_id = (select private.current_household_id())
      and (not t.is_private or t.created_by = auth.uid())
      and t.completed_at is null;
  if not found then
    raise exception 'No open task with this id in your household' using errcode = 'P0002';
  end if;
end;
$$;
