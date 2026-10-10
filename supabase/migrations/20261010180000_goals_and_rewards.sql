-- Goals and rewards (ADR 0007): a goal is a reward the household or one member works towards, reached with the
-- points of shared tasks done after it was set. A shared goal (owner_id null) counts everyone's points and the whole
-- household sees it; a personal goal counts only its owner's points, and the household sees it too so they can follow
-- and celebrate it, but only the owner deletes or claims it. Points aren't spent: the same points count towards every
-- goal they apply to. Once reached, the reward is claimed with claim_goal_reward(), and the goal stays as history.
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.current_household_id()
    references public.households (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80 and title = btrim(title)),
  target_points integer not null check (target_points between 1 and 10000),
  -- Whose goal it is; null for a shared family goal. A personal goal goes with its owner's account.
  owner_id uuid references auth.users (id) on delete cascade,
  -- Kept when the creator deletes their account, so a shared goal stays.
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  claimed_by uuid references auth.users (id) on delete set null
);
create index goals_household_id_idx on public.goals (household_id);

alter table public.goals enable row level security;

-- Members add and delete goals directly (as RLS allows); claiming goes through claim_goal_reward(), which checks
-- the goal is reached. created_by, created_at and household_id always come from their defaults.
revoke all on table public.goals from anon, authenticated;
grant select, delete on table public.goals to authenticated;
grant insert (title, target_points, owner_id) on table public.goals to authenticated;

create policy "Members can view their household's goals"
  on public.goals for select to authenticated
  using (household_id = (select private.current_household_id()));

-- Nobody sets a personal goal for someone else.
create policy "Members can add shared goals and their own personal ones"
  on public.goals for insert to authenticated
  with check (
    household_id = (select private.current_household_id())
    and created_by = (select auth.uid())
    and (owner_id is null or owner_id = (select auth.uid()))
  );

-- Someone's personal goal is theirs to delete. Claimed goals stay as the household's history.
create policy "Members can delete open shared goals and their own personal ones"
  on public.goals for delete to authenticated
  using (
    household_id = (select private.current_household_id())
    and (owner_id is null or owner_id = (select auth.uid()))
    and claimed_at is null
  );

-- The points that count towards a goal: those of shared tasks in its household done from when it was set until it
-- was claimed, by anyone for a shared goal and by its owner for a personal one. Security invoker: called through
-- household_goals() RLS applies too; claim_goal_reward() reads it as the definer, scoped by the goal's household.
create function private.goal_points(goal public.goals)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(t.points), 0)::integer from public.tasks t
  where t.household_id = goal.household_id
    and not t.is_private
    and t.completed_at >= goal.created_at
    and t.completed_at <= coalesce(goal.claimed_at, 'infinity')
    and (goal.owner_id is null or t.completed_by = goal.owner_id);
$$;
revoke execute on function private.goal_points(public.goals) from public;
grant execute on function private.goal_points(public.goals) to authenticated;

-- The household's goals with the points towards each and the owner's display name, open goals first (newest first),
-- then claimed ones (most recently claimed first). Security invoker, so Row Level Security scopes it.
create function public.household_goals()
returns table (
  id uuid,
  title text,
  target_points integer,
  owner_id uuid,
  owner_name text,
  created_at timestamptz,
  claimed_at timestamptz,
  points integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select g.id, g.title, g.target_points, g.owner_id, p.display_name, g.created_at, g.claimed_at,
    private.goal_points(g)
  from public.goals g
  left join public.profiles p on p.id = g.owner_id
  order by g.claimed_at desc nulls first, g.created_at desc, g.id;
$$;
revoke execute on function public.household_goals() from public, anon;
grant execute on function public.household_goals() to authenticated;

-- Claims the reward of an open shared goal or the user's own personal goal once its points reach the target. Raises no_data_found
-- (P0002) if there is no such open goal, and check_violation (23514) if it hasn't been reached yet.
create function public.claim_goal_reward(goal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  goal public.goals;
begin
  -- The row lock makes a second, simultaneous claim find the goal already claimed.
  select * into goal from public.goals g
    where g.id = claim_goal_reward.goal_id
      and g.household_id = (select private.current_household_id())
      and (g.owner_id is null or g.owner_id = auth.uid())
      and g.claimed_at is null
    for update;
  if goal.id is null then
    raise exception 'No open goal with this id in your household' using errcode = 'P0002';
  end if;
  if private.goal_points(goal) < goal.target_points then
    raise exception 'This goal has not been reached yet' using errcode = '23514';
  end if;
  update public.goals g set claimed_at = now(), claimed_by = auth.uid() where g.id = goal.id;
end;
$$;
revoke execute on function public.claim_goal_reward(uuid) from public, anon;
grant execute on function public.claim_goal_reward(uuid) to authenticated;
