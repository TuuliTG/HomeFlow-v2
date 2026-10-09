-- Task reminders (ADR 0004, ADR 0005): a member can ask to be reminded of a task that is theirs to do, a private
-- task they added or a task they picked up, at a time they choose. The send-reminders Edge Function, run every
-- minute by Supabase Cron, sends a push notification to their devices.
create table public.task_reminders (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  remind_at timestamptz not null,
  primary key (task_id, user_id)
);
create index task_reminders_remind_at_idx on public.task_reminders (remind_at);

alter table public.task_reminders enable row level security;

-- A reminder is the user's own: nobody else in the household sees it. Setting and removing one goes through the
-- functions below, which check the task is theirs to do.
revoke all on table public.task_reminders from anon, authenticated;
grant select on table public.task_reminders to authenticated;

create policy "Users can view their own task reminders"
  on public.task_reminders for select to authenticated
  using (user_id = (select auth.uid()));

-- Whether the task is open and the user's to do: a private task they added, or one they picked up. Callers check
-- the household themselves.
create function private.is_task_to_do_by(task public.tasks, doer uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select task.completed_at is null
    and ((task.is_private and task.created_by = doer) or task.picked_up_by = doer);
$$;

revoke execute on function private.is_task_to_do_by(public.tasks, uuid) from public;

-- Sets (or moves) the user's reminder for an open task that is theirs to do. Raises no_data_found (P0002) if the
-- task isn't, and invalid_parameter_value (22023) for a time in the past or more than a year ahead.
create function public.set_task_reminder(task_id uuid, remind_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if remind_at is null or remind_at < now() - interval '1 minute' or remind_at > now() + interval '1 year' then
    raise exception 'A reminder must be within the next year' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.tasks t
      where t.id = set_task_reminder.task_id
        and t.household_id = (select private.current_household_id())
        and private.is_task_to_do_by(t, auth.uid())
  ) then
    raise exception 'No open task of yours with this id' using errcode = 'P0002';
  end if;
  insert into public.task_reminders (task_id, user_id, remind_at)
  values (set_task_reminder.task_id, auth.uid(), set_task_reminder.remind_at)
  on conflict on constraint task_reminders_pkey do update set remind_at = excluded.remind_at;
end;
$$;

-- Removes the user's reminder for a task, if they have one.
create function public.clear_task_reminder(task_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.task_reminders r
    where r.task_id = clear_task_reminder.task_id and r.user_id = auth.uid();
$$;

revoke execute on function public.set_task_reminder(uuid, timestamptz), public.clear_task_reminder(uuid)
  from public, anon;
grant execute on function public.set_task_reminder(uuid, timestamptz), public.clear_task_reminder(uuid)
  to authenticated;

-- As before (20261008190000_pick_up_tasks.sql), and putting a task back also removes the user's reminder for it.
create or replace function public.put_back_task(task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tasks t set picked_up_by = null, picked_up_at = null
    where t.id = put_back_task.task_id
      and t.household_id = (select private.current_household_id())
      and t.completed_at is null
      and t.picked_up_by = auth.uid();
  if not found then
    raise exception 'You have not picked up this open task' using errcode = 'P0002';
  end if;
  delete from public.task_reminders r where r.task_id = put_back_task.task_id and r.user_id = auth.uid();
end;
$$;

-- For the send-reminders Edge Function only: removes every reminder that is due and returns those whose task is
-- still open and the user's to do, and whose time is less than an hour ago (after an outage, a task done meanwhile
-- or a reminder hours late isn't worth a notification). Taking them out in one statement means two overlapping runs
-- can't send the same reminder twice.
create function public.take_due_reminders()
returns table (user_id uuid, task_title text)
language sql
security definer
set search_path = ''
as $$
  with due as (
    delete from public.task_reminders r where r.remind_at <= now()
      returning r.task_id, r.user_id, r.remind_at
  )
  select due.user_id, t.title
    from due join public.tasks t on t.id = due.task_id
    where private.is_task_to_do_by(t, due.user_id) and due.remind_at > now() - interval '1 hour';
$$;

revoke execute on function public.take_due_reminders() from public, anon, authenticated;
grant execute on function public.take_due_reminders() to service_role;
