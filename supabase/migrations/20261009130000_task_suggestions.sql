-- Task suggestions (ADR 0004): the tasks the user's household has added before, so a member can add one again with
-- the same details. One row per title (ignoring case) with the details of its newest
-- occurrence, most often added first. Occurrences a repeating task adds itself aren't counted, so a daily task doesn't
-- push out everything else. Deleted tasks are gone from the table, so a task added by mistake and deleted isn't
-- suggested. Security invoker, so Row Level Security applies: other members' private tasks are never suggested.
create function public.task_suggestions()
returns table (
  title text,
  description text,
  type text,
  points smallint,
  repeat_every_days smallint,
  is_private boolean,
  times_added integer,
  is_open boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with household_tasks as (
    select t.*, lower(t.title) as title_key from public.tasks t
    where t.household_id = (select private.current_household_id())
  ),
  newest as (
    select distinct on (h.title_key) h.* from household_tasks h order by h.title_key, h.created_at desc, h.id
  ),
  usage as (
    select
      h.title_key,
      count(*) filter (where h.previous_task_id is null)::integer as times_added,
      max(h.created_at) filter (where h.previous_task_id is null) as last_added_at,
      bool_or(h.completed_at is null) as is_open
    from household_tasks h
    group by h.title_key
  )
  select n.title, n.description, n.type, n.points, n.repeat_every_days, n.is_private, u.times_added, u.is_open
  from newest n
  join usage u using (title_key)
  order by u.times_added desc, u.last_added_at desc nulls last, n.title
  limit 50;
$$;
revoke execute on function public.task_suggestions() from public, anon;
grant execute on function public.task_suggestions() to authenticated;
