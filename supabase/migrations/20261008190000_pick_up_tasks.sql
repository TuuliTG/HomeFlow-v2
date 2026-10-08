-- Picking up tasks (ADR 0004): a member says "I'll do this" so the others know it's taken. Members still can't
-- update tasks directly; picking up and putting back go through the functions below.
alter table public.tasks
  -- Kept when the member deletes their account, like created_by, so the history stays intact.
  add column picked_up_by uuid references auth.users (id) on delete set null,
  add column picked_up_at timestamptz,
  constraint tasks_picked_up_together check ((picked_up_by is null) = (picked_up_at is null));

-- Marks an open task in the user's household as picked up by them. Picking up a task they already have is a
-- no-op. Raises no_data_found (P0002) if the task isn't open in their household, and object_in_use (55006) if
-- someone else has picked it up.
create function public.pick_up_task(task_id uuid)
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

-- Puts back an open task the user has picked up, so anyone can pick it up again. Raises no_data_found (P0002)
-- if the user hasn't picked up this open task.
create function public.put_back_task(task_id uuid)
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
end;
$$;

revoke execute on function public.pick_up_task(uuid), public.put_back_task(uuid) from public, anon;
grant execute on function public.pick_up_task(uuid), public.put_back_task(uuid) to authenticated;
