-- Scheduling tasks (ADR 0004): a member plans when to do a task that is theirs to do, a private task they added or
-- a task they picked up, as a block of time in the timetable on their Me page. Like a reminder, a schedule is the
-- member's own: nobody else in the household sees it.
create table public.task_schedules (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  starts_at timestamptz not null,
  duration_minutes integer not null constraint task_schedules_duration_range check (duration_minutes between 5 and 720),
  primary key (task_id, user_id)
);
create index task_schedules_user_id_idx on public.task_schedules (user_id);

alter table public.task_schedules enable row level security;

-- Setting and removing a schedule goes through the functions below, which check the task is the user's to do.
revoke all on table public.task_schedules from anon, authenticated;
grant select on table public.task_schedules to authenticated;

create policy "Users can view their own task schedules"
  on public.task_schedules for select to authenticated
  using (user_id = (select auth.uid()));

-- Schedules (or moves) an open task that is the user's to do. Raises no_data_found (P0002) if the task isn't, and
-- invalid_parameter_value (22023) for a start more than a year away or a length outside 5 minutes to 12 hours.
create function public.set_task_schedule(task_id uuid, starts_at timestamptz, duration_minutes integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if starts_at is null or starts_at < now() - interval '1 year' or starts_at > now() + interval '1 year' then
    raise exception 'A task can be scheduled up to a year away' using errcode = '22023';
  end if;
  if duration_minutes is null or duration_minutes not between 5 and 720 then
    raise exception 'A scheduled task takes 5 minutes to 12 hours' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.tasks t
      where t.id = set_task_schedule.task_id
        and private.can_see_task(t)
        and private.is_task_to_do_by(t, auth.uid())
  ) then
    raise exception 'No open task of yours with this id' using errcode = 'P0002';
  end if;
  insert into public.task_schedules (task_id, user_id, starts_at, duration_minutes)
  values (set_task_schedule.task_id, auth.uid(), set_task_schedule.starts_at, set_task_schedule.duration_minutes)
  on conflict on constraint task_schedules_pkey do update
    set starts_at = excluded.starts_at, duration_minutes = excluded.duration_minutes;
end;
$$;

-- Removes the user's schedule for a task, if they have one.
create function public.clear_task_schedule(task_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.task_schedules s
    where s.task_id = clear_task_schedule.task_id and s.user_id = auth.uid();
$$;

revoke execute on function public.set_task_schedule(uuid, timestamptz, integer), public.clear_task_schedule(uuid)
  from public, anon;
grant execute on function public.set_task_schedule(uuid, timestamptz, integer), public.clear_task_schedule(uuid)
  to authenticated;

-- Whoever gives a task back, by put_back_task() or by becoming a child (private.put_back_adults_tasks()), no longer
-- plans to do it. A trigger covers every way a task changes hands.
create function private.clear_schedule_of_previous_picker()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.task_schedules s where s.task_id = new.id and s.user_id = old.picked_up_by;
  return null;
end;
$$;

revoke execute on function private.clear_schedule_of_previous_picker() from public;

create trigger tasks_clear_schedule_of_previous_picker
  after update of picked_up_by on public.tasks
  for each row
  when (old.picked_up_by is not null and old.picked_up_by is distinct from new.picked_up_by)
  execute function private.clear_schedule_of_previous_picker();
