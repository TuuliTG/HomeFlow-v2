-- Helping earns bonus points (ADR 0004): parents found that doing a task with a child's help takes longer, not less,
-- so giving the helper points shouldn't cost the doer any. Whoever marked a task done now keeps all its points, and
-- each helper earns their bonus (1–10) on top. Children don't say who helped: the tasks they do are theirs.

-- As before (20261011220000_task_helpers.sql), but the doer is credited the task's full points.
create or replace view private.task_credits as
  select t.id as task_id, t.household_id, t.completed_by as user_id, t.type, t.completed_at,
    t.points::integer as points
  from public.tasks t
  where t.completed_by is not null and not t.is_private
  union all
  select t.id, t.household_id, h.user_id, t.type, t.completed_at, h.points::integer
  from public.task_helpers h
  join public.tasks t on t.id = h.task_id
  where t.completed_at is not null and not t.is_private;
revoke all on table private.task_credits from public, anon, authenticated;

-- Sets who helped with a shared task the user marked done in the last week, and the bonus points each earns:
-- helpers = [{"user_id": "…", "points": 2}, …], replacing earlier ones; [] for nobody. Raises insufficient_privilege
-- (42501) for a child, and for a helper who is the user or outside the household, no_data_found (P0002) unless the
-- user marked the task done in the last week and it has points, and check_violation (23514) for someone listed twice
-- or a bonus outside 1–10.
create or replace function public.set_task_helpers(task_id uuid, helpers jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  done public.tasks;
begin
  if private.is_child(auth.uid()) then
    raise exception 'Children don''t say who helped' using errcode = '42501';
  end if;
  if jsonb_typeof(set_task_helpers.helpers) is distinct from 'array' then
    raise exception 'List who helped' using errcode = '22023';
  end if;
  -- The row lock makes a second, simultaneous save wait for the first.
  select * into done from public.tasks t
    where t.id = set_task_helpers.task_id
      and private.can_see_task(t)
      and t.completed_by = auth.uid()
      and t.completed_at > now() - interval '7 days'
      and not t.is_private
      and t.points is not null
    for update;
  if done.id is null then
    raise exception 'You have not marked this task done in the last week' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(set_task_helpers.helpers) as h (user_id uuid, points integer)
      where h.user_id is null or h.user_id = auth.uid() or not exists (
        select 1 from public.household_members m where m.user_id = h.user_id and m.household_id = done.household_id
      )
  ) then
    raise exception 'Helpers are other members of the household' using errcode = '42501';
  end if;
  if (
    select count(distinct h.user_id)
      from jsonb_to_recordset(set_task_helpers.helpers) as h (user_id uuid, points integer)
  ) <> jsonb_array_length(set_task_helpers.helpers) then
    raise exception 'Someone is listed twice' using errcode = '23514';
  end if;
  delete from public.task_helpers h where h.task_id = done.id;
  insert into public.task_helpers (task_id, user_id, points)
    select done.id, h.user_id, h.points
      from jsonb_to_recordset(set_task_helpers.helpers) as h (user_id uuid, points smallint);
end;
$$;
