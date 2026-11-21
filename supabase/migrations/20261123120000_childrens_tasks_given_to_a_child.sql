-- Every open shared task for children is one child's (ADR 0004): adults set a child's tasks up on the child's page,
-- so a task for any child had no place left. A child's own new task is theirs, a child who becomes an adult or is
-- removed takes their open ones with them, and the tasks for any child already there are given to a child.

-- The open tasks for any child go to the child who has them picked up or was asked to do them, else to each child
-- in the household: the task itself to the first, a copy (with its pictures) to each of the others. Those in a
-- household without children go, as nobody could do them.
create temporary table orphans on commit drop as
  select t.id, t.household_id,
    coalesce(
      case when private.is_child_in_household(t.picked_up_by, t.household_id) then t.picked_up_by end,
      (select r.requested_for from public.task_requests r
        where r.task_id = t.id and private.is_child_in_household(r.requested_for, t.household_id))
    ) as child_id
  from public.tasks t
  where t.for_children and not t.is_private and t.completed_at is null and t.assigned_to is null;

update public.tasks t set assigned_to = o.child_id
  from orphans o
  where o.id = t.id and o.child_id is not null;

create temporary table orphan_children on commit drop as
  select o.id as task_id, m.user_id as child_id,
    row_number() over (partition by o.id order by m.joined_at, m.user_id) as nth,
    gen_random_uuid() as copy_id
  from orphans o
  join public.household_members m on m.household_id = o.household_id and m.is_child
  where o.child_id is null;

insert into public.tasks
  (id, household_id, title, description, type, points, created_by, created_at, repeat_every_days, due_on,
   is_private, for_children, icon, assigned_to, labels, custom_labels, is_routine, is_always, daily_limit,
   times_done, times_done_on)
  select c.copy_id, t.household_id, t.title, t.description, t.type, t.points, t.created_by, t.created_at,
    t.repeat_every_days, t.due_on, false, true, t.icon, c.child_id, t.labels, t.custom_labels, t.is_routine,
    t.is_always, t.daily_limit, t.times_done, t.times_done_on
  from orphan_children c
  join public.tasks t on t.id = c.task_id
  where c.nth > 1;

insert into public.task_images (task_id, path, position)
  select c.copy_id, i.path, i.position
  from orphan_children c
  join public.task_images i on i.task_id = c.task_id
  where c.nth > 1;

update public.tasks t set assigned_to = c.child_id
  from orphan_children c
  where c.task_id = t.id and c.nth = 1;

delete from public.tasks t
  using orphans o
  where o.id = t.id and t.assigned_to is null;

alter table public.tasks
  add constraint tasks_childrens_given_to_a_child
    check (is_private or not for_children or completed_at is not null or assigned_to is not null);

-- A child's new shared task is given to them, so it is on their Me page and on their page for adults. Named to run
-- before tasks_pick_up_for_assignee, which then picks it up for them.
create function private.give_childs_task_to_them()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.for_children and not new.is_private and new.assigned_to is null
    and private.is_child_in_household(new.created_by, new.household_id) then
    new.assigned_to := new.created_by;
  end if;
  return new;
end;
$$;
revoke execute on function private.give_childs_task_to_them() from public;

create trigger tasks_give_childs_task_to_them
  before insert on public.tasks
  for each row
  execute function private.give_childs_task_to_them();

-- As before (20261122120000_always_tasks.sql), but a child's shared task is given to them (by the trigger above).
drop policy "Adults and permitted children can add tasks to their household" on public.tasks;
create policy "Adults and permitted children can add tasks to their household"
  on public.tasks for insert to authenticated
  with check (
    household_id = (select private.current_household_id())
    and created_by = (select auth.uid())
    and case
      when (select private.is_child((select auth.uid()))) then
        (select private.can_add_tasks((select auth.uid()))) and for_children and points is null
        and (assigned_to is null or assigned_to = (select auth.uid())) and not is_always
      else (is_private or points is not null)
        and (assigned_to is null or private.is_child_in_household(assigned_to, household_id))
    end
  );

-- A child who becomes an adult no longer has tasks for children: the open ones given to them go, with their
-- reminders, plans and requests; the done ones stay, no longer given to them, so undoing one can't reopen a task
-- given to an adult. As before (20261108130000_tasks_for_children_only.sql), they also give back the other open
-- tasks for children they had.
create or replace function private.clear_assignments_of_new_adult()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.tasks t where t.assigned_to = new.user_id and t.completed_at is null;
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

-- As before (20261122120000_always_tasks.sql), but a task made adults-only is no longer given to a child.
create or replace function public.update_task(
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
  task_daily_limit smallint default null
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
  picker uuid;
begin
  if task_for_children is false and is_child then
    raise exception 'Only adults can make a task adults-only' using errcode = '42501';
  end if;
  if changes_assignee and task_assigned_to is not null
    and not private.is_child_in_household(task_assigned_to, private.current_household_id()) then
    raise exception 'No child with this id in your household' using errcode = 'P0002';
  end if;
  update public.tasks t
    set title = task_title, description = task_description, type = task_type,
        points = case when is_child then null else task_points end,
        due_on = task_due_on, repeat_every_days = task_repeat_every_days,
        for_children = coalesce(task_for_children, t.for_children),
        icon = task_icon,
        assigned_to = case
          when not coalesce(task_for_children, t.for_children) then null
          when changes_assignee then task_assigned_to
          else t.assigned_to
        end,
        labels = coalesce(task_labels, t.labels),
        custom_labels = coalesce(task_custom_labels, t.custom_labels),
        -- Only a repeating task is a routine: one made one-off stops being one.
        is_routine = coalesce(task_is_routine, t.is_routine) and task_repeat_every_days is not null,
        is_always = coalesce(sets_always, t.is_always),
        daily_limit = case
          when sets_always is null then t.daily_limit
          when sets_always then task_daily_limit
        end
    where t.id = update_task.task_id
      and private.can_change_task(t)
      and t.completed_at is null
      and (is_child or t.is_private or task_points is not null)
    returning t.picked_up_by into picker;
  if not found then
    raise exception 'No open task with this id in your household' using errcode = 'P0002';
  end if;
  if task_for_children is false and private.is_child(picker) then
    perform private.put_back_adults_tasks(picker);
  end if;
end;
$$;

-- As before (20261121120000_remove_children.sql), and the child's open chores go too: the cascade would leave them
-- given to nobody. Their done ones stay, done by nobody.
create or replace function public.remove_child(child_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  household uuid := private.adult_household_id(auth.uid());
begin
  if household is null then
    raise exception 'Only an adult in the household can remove a child' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.household_members m
      where m.user_id = remove_child.child_id and m.household_id = household and m.signs_in_with_code
  ) then
    raise exception 'No child with this id signs in with a code in your household' using errcode = 'P0002';
  end if;
  delete from public.tasks t
    where (t.created_by = remove_child.child_id and t.is_private)
      or (t.assigned_to = remove_child.child_id and t.completed_at is null);
  update public.tasks t set picked_up_by = null, picked_up_at = null
    where t.picked_up_by = remove_child.child_id;
  delete from auth.users u where u.id = remove_child.child_id;
end;
$$;
