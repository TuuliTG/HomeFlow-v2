-- Asking a family member to do a task (ADR 0004). A member asks another to do an open shared task; the other is
-- notified (the notify-request Edge Function, ADR 0005) and accepts, which picks the task up for them, or declines.
-- Nobody is given a task without saying yes, so tasks are still only ever taken, never assigned.
create table public.task_requests (
  id uuid primary key default gen_random_uuid(),
  -- One request per task at a time: asking again replaces it.
  task_id uuid not null unique references public.tasks (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete cascade,
  requested_for uuid not null references auth.users (id) on delete cascade,
  requested_at timestamptz not null default now(),
  -- Null while waiting for an answer.
  answer text constraint task_requests_answer_values check (answer in ('accepted', 'declined')),
  answered_at timestamptz,
  constraint task_requests_answered_together check ((answer is null) = (answered_at is null)),
  constraint task_requests_someone_else check (requested_by <> requested_for)
);
create index task_requests_requested_for_idx on public.task_requests (requested_for);

alter table public.task_requests enable row level security;

-- Asking, answering and cancelling go through the functions below.
revoke all on table public.task_requests from anon, authenticated;
grant select on table public.task_requests to authenticated;
-- notify-request reads the request it is told about.
grant select on table public.task_requests to service_role;

-- A request shows with its task: whoever can see the task (the tasks select policy applies in the subquery).
create policy "Members can view the requests of tasks they may see"
  on public.task_requests for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_requests.task_id));

-- Asks another member of the household to do an open shared task, replacing any earlier request for it. The task
-- must be free or picked up by the user, who can hand it over this way. Raises invalid_parameter_value (22023) for
-- asking oneself, no_data_found (P0002) unless the task is an open shared one the user sees and the member is in
-- their household and may do it (a child only a task for children), and object_in_use (55006) if someone else has
-- picked the task up.
create function public.request_task(task_id uuid, member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  task public.tasks;
begin
  if member_id is null or member_id = auth.uid() then
    raise exception 'Ask another member of your household' using errcode = '22023';
  end if;
  -- Locks the task, so it can't be picked up meanwhile.
  select * into task from public.tasks t
    where t.id = request_task.task_id
      and private.can_see_task(t)
      and t.completed_at is null
      and not t.is_private
    for update;
  if task.id is null then
    raise exception 'No open shared task with this id in your household' using errcode = 'P0002';
  end if;
  if task.picked_up_by is not null and task.picked_up_by <> auth.uid() then
    raise exception 'Someone else has picked up this task' using errcode = '55006';
  end if;
  if not exists (
    select 1 from public.household_members m
      where m.user_id = request_task.member_id
        and m.household_id = task.household_id
        and (task.for_children or not m.is_child)
  ) then
    raise exception 'No member with this id in your household can do this task' using errcode = 'P0002';
  end if;
  -- Deleted and added rather than updated, so the webhook sees a new request as an insert.
  delete from public.task_requests r where r.task_id = task.id;
  insert into public.task_requests (task_id, requested_by, requested_for)
    values (task.id, auth.uid(), request_task.member_id);
  -- Touches the task, so members' apps refresh it live (ADR 0004) and show the request.
  update public.tasks t set title = t.title where t.id = task.id;
end;
$$;

-- Accepts or declines a request waiting for the user's answer. Accepting picks the task up for them, also from
-- whoever asked if they had it. Raises invalid_parameter_value (22023) without an answer and no_data_found (P0002)
-- if no request for the task waits for the user or the task is no longer open for them to take.
create function public.answer_task_request(task_id uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request public.task_requests;
begin
  if accept is null then
    raise exception 'Accept or decline the request' using errcode = '22023';
  end if;
  select * into request from public.task_requests r
    where r.task_id = answer_task_request.task_id
      and r.requested_for = auth.uid()
      and r.answer is null
    for update;
  if request.id is null then
    raise exception 'No request for this task waits for your answer' using errcode = 'P0002';
  end if;
  if accept then
    update public.tasks t set picked_up_by = auth.uid(), picked_up_at = now()
      where t.id = request.task_id
        and private.can_see_task(t)
        and t.completed_at is null
        and (t.picked_up_by is null or t.picked_up_by = request.requested_by);
    if not found then
      raise exception 'This task is no longer open for you to take' using errcode = 'P0002';
    end if;
  else
    update public.tasks t set title = t.title where t.id = request.task_id;
  end if;
  update public.task_requests r
    set answer = case when accept then 'accepted' else 'declined' end, answered_at = now()
    where r.id = request.id;
end;
$$;

-- Withdraws the user's request for a task that hasn't been accepted, or clears one that was declined. Raises
-- no_data_found (P0002) if they have no such request.
create function public.cancel_task_request(task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.task_requests r
    where r.task_id = cancel_task_request.task_id
      and r.requested_by = auth.uid()
      and r.answer is distinct from 'accepted';
  if not found then
    raise exception 'You have no open request for this task' using errcode = 'P0002';
  end if;
  update public.tasks t set title = t.title where t.id = cancel_task_request.task_id;
end;
$$;

revoke execute on function public.request_task(uuid, uuid), public.answer_task_request(uuid, boolean),
  public.cancel_task_request(uuid) from public, anon;
grant execute on function public.request_task(uuid, uuid), public.answer_task_request(uuid, boolean),
  public.cancel_task_request(uuid) to authenticated;

-- A request is settled once the task is done or someone other than the member asked picks it up, however that
-- happens, so nobody is left asked to do a task that is already taken.
create function private.settle_task_requests()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.task_requests r
    where r.task_id = new.id
      and (new.completed_at is not null or r.requested_for is distinct from new.picked_up_by);
  return null;
end;
$$;

revoke execute on function private.settle_task_requests() from public;

create trigger tasks_settle_task_requests
  after update of picked_up_by, completed_at on public.tasks
  for each row
  when (
    (old.completed_at is null and new.completed_at is not null)
    or (new.picked_up_by is not null and old.picked_up_by is distinct from new.picked_up_by)
  )
  execute function private.settle_task_requests();
