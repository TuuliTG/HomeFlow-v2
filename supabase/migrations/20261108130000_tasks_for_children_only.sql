-- Tasks for children are children's only (ADR 0004). Parents want the children's chores kept apart from their own:
-- an adult can add, edit and delete a shared task for children, but not pick it up, be asked to do it or mark it done,
-- so its stars always go to a child. The adults have their own tasks, e.g. their own "Empty the dishwasher" with
-- different points. Private tasks are their creator's own to do, so they are left out (a child who became an adult
-- keeps theirs).

-- Whether the member may hold or do a task: an adult not a shared task for children. Security definer like
-- is_child(), for the triggers below.
create function private.can_do_task(task public.tasks, member uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select task.is_private or not task.for_children or private.is_child(member);
$$;
revoke execute on function private.can_do_task(public.tasks, uuid) from public;

-- Every way a task is picked up, marked done or reopened passes here: pick_up_task(), complete_task(), accepting a
-- request, giving a task to a child and undo_complete_task(). Raises insufficient_privilege (42501) for an adult and a
-- shared task for children; reopening one that a child who has since become an adult had picked up puts it back.
create function private.check_task_doer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.picked_up_by is not null and new.picked_up_by is distinct from old.picked_up_by
    and not private.can_do_task(new, new.picked_up_by) then
    raise exception 'Only children pick up tasks for children' using errcode = '42501';
  end if;
  if old.completed_at is null and new.completed_at is not null and not private.can_do_task(new, new.completed_by) then
    raise exception 'Only children mark tasks for children done' using errcode = '42501';
  end if;
  if old.completed_at is not null and new.completed_at is null and new.picked_up_by is not null
    and not private.can_do_task(new, new.picked_up_by) then
    new.picked_up_by := null;
    new.picked_up_at := null;
  end if;
  return new;
end;
$$;
revoke execute on function private.check_task_doer() from public;

create trigger tasks_check_task_doer
  before update of picked_up_by, completed_at on public.tasks
  for each row
  execute function private.check_task_doer();

-- Takes a shared task for children back from adults: puts it back if an adult picked it up (the triggers on
-- picked_up_by then clear their schedule), and removes adults' reminders for it and requests to them.
create function private.put_back_from_adults(task_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.task_reminders r
    where r.task_id = put_back_from_adults.task_id and not private.is_child(r.user_id);
  delete from public.task_requests r
    where r.task_id = put_back_from_adults.task_id and not private.is_child(r.requested_for);
  update public.tasks t set picked_up_by = null, picked_up_at = null
    where t.id = put_back_from_adults.task_id
      and t.completed_at is null
      and t.picked_up_by is not null
      and not private.is_child(t.picked_up_by);
$$;
revoke execute on function private.put_back_from_adults(uuid) from public;

-- Making a task one for children (update_task()) takes it back from adults.
create function private.put_back_new_childrens_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.put_back_from_adults(new.id);
  return null;
end;
$$;
revoke execute on function private.put_back_new_childrens_task() from public;

create trigger tasks_put_back_new_childrens_task
  after update of for_children on public.tasks
  for each row
  when (new.for_children and not old.for_children and not new.is_private and new.completed_at is null)
  execute function private.put_back_new_childrens_task();

-- As before (20261024120000_assigned_tasks.sql), and a child who becomes an adult also gives back the open tasks for
-- children they picked up, with their reminders and the requests to them.
create or replace function private.clear_assignments_of_new_adult()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tasks t set assigned_to = null where t.assigned_to = new.user_id;
  perform private.put_back_from_adults(t.id)
    from public.tasks t
    where t.household_id = new.household_id and t.for_children and not t.is_private and t.completed_at is null
      and (
        t.picked_up_by = new.user_id
        or exists (select 1 from public.task_reminders r where r.task_id = t.id and r.user_id = new.user_id)
        or exists (select 1 from public.task_requests r where r.task_id = t.id and r.requested_for = new.user_id)
      );
  return null;
end;
$$;

-- As before (20261024120000_assigned_tasks.sql), but only children can be asked to do a task for children, and only
-- adults an adults-only one.
create or replace function public.request_task(task_id uuid, member_id uuid)
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
      and t.assigned_to is null
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
        and m.is_child = task.for_children
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

-- Adults give back the open tasks for children they hold now.
do $$
begin
  perform private.put_back_from_adults(t.id)
    from public.tasks t
    where t.for_children and not t.is_private and t.completed_at is null;
end
$$;
