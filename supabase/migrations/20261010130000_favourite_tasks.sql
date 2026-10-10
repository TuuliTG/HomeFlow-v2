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
  using (user_id = (select auth.uid()));
