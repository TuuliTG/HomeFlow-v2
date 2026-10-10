-- Favourite tasks (ADR 0004): names of tasks members have starred on the New task form, where they are offered to
-- add again. Shared by the household: a star any member sets or removes shows for everyone. Stored by name ignoring
-- case, like task_suggestions() groups tasks, so a favourite stays one when the task is added again.
create table public.favourite_tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.current_household_id()
    references public.households (id) on delete cascade,
  -- The task's name in lower case, without spaces around it.
  title_key text not null check (title_key = lower(btrim(title_key)) and char_length(title_key) between 1 and 80),
  -- Who starred it; one row per member who did, so a star never reveals another member's (private) one.
  starred_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (household_id, title_key, starred_by)
);

alter table public.favourite_tasks enable row level security;

revoke all on table public.favourite_tasks from anon, authenticated;
grant select, delete on table public.favourite_tasks to authenticated;
grant insert (title_key) on table public.favourite_tasks to authenticated;

-- Whether the user can see the favourite: one they starred themselves, or one whose task they can see (tasks' own
-- RLS applies here), so a star on another member's private task doesn't reveal its name.
create function private.can_see_favourite(favourite public.favourite_tasks)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select favourite.household_id = (select private.current_household_id())
    and (
      favourite.starred_by = (select auth.uid())
      or exists (
        select 1 from public.tasks t
        where t.household_id = favourite.household_id and lower(btrim(t.title)) = favourite.title_key
      )
    );
$$;

revoke execute on function private.can_see_favourite(public.favourite_tasks) from public;
grant execute on function private.can_see_favourite(public.favourite_tasks) to authenticated;

create policy "Members can view their household's favourite tasks"
  on public.favourite_tasks for select to authenticated
  using (private.can_see_favourite(favourite_tasks));

create policy "Members can star tasks for their household"
  on public.favourite_tasks for insert to authenticated
  with check (
    starred_by = (select auth.uid()) and household_id = (select private.current_household_id())
  );

-- Any member can unstar a favourite they can see, whoever starred it.
create policy "Members can unstar their household's favourite tasks"
  on public.favourite_tasks for delete to authenticated
  using (private.can_see_favourite(favourite_tasks));

-- task_suggestions() as before, but the household's favourites are always included, even beyond the 50 most often
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
        where f.household_id = n.household_id and f.title_key = btrim(n.title_key)
      ) as is_favourite
    from newest n
    join usage u using (title_key)
  )
  select r.title, r.description, r.type, r.points, r.repeat_every_days, r.is_private, r.times_added, r.is_open
  from ranked r
  where r.rank <= 50 or r.is_favourite
  order by r.rank;
$$;
