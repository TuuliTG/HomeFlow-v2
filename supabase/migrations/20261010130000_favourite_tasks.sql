-- Favourite tasks (ADR 0004): names of tasks a member has starred on the New task form, where they are offered to
-- add again. Each member has their own, per household. Stored by name ignoring case, like task_suggestions()
-- groups tasks, so a favourite stays one when the task is added again.
create table public.favourite_tasks (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid not null default private.current_household_id()
    references public.households (id) on delete cascade,
  -- The task's name in lower case, without spaces around it.
  title_key text not null check (title_key = lower(btrim(title_key)) and char_length(title_key) between 1 and 80),
  primary key (user_id, household_id, title_key)
);

alter table public.favourite_tasks enable row level security;

-- A member's favourites are their own: nobody else in the household sees them.
revoke all on table public.favourite_tasks from anon, authenticated;
grant select, delete on table public.favourite_tasks to authenticated;
grant insert (title_key) on table public.favourite_tasks to authenticated;

create policy "Users can view their own favourite tasks"
  on public.favourite_tasks for select to authenticated
  using (user_id = (select auth.uid()) and household_id = (select private.current_household_id()));

create policy "Users can add their own favourite tasks"
  on public.favourite_tasks for insert to authenticated
  with check (user_id = (select auth.uid()) and household_id = (select private.current_household_id()));

create policy "Users can remove their own favourite tasks"
  on public.favourite_tasks for delete to authenticated
  using (user_id = (select auth.uid()) and household_id = (select private.current_household_id()));

-- task_suggestions() as before, but the user's favourites are always included, even beyond the 50 most often
-- added tasks, so a rarely added favourite is still offered.
create or replace function public.task_suggestions()
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
  ),
  ranked as (
    select
      n.title, n.description, n.type, n.points, n.repeat_every_days, n.is_private, u.times_added, u.is_open,
      row_number() over (order by u.times_added desc, u.last_added_at desc nulls last, n.title) as rank,
      exists (
        select 1 from public.favourite_tasks f
        where f.user_id = (select auth.uid()) and f.title_key = btrim(n.title_key)
      ) as is_favourite
    from newest n
    join usage u using (title_key)
  )
  select r.title, r.description, r.type, r.points, r.repeat_every_days, r.is_private, r.times_added, r.is_open
  from ranked r
  where r.rank <= 50 or r.is_favourite
  order by r.rank;
$$;
