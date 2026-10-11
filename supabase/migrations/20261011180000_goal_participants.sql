-- Shared goals for chosen members (ADR 0007): an adult picks who takes part in a shared goal, the whole family or,
-- say, two siblings, and can ask each of them for their own minimum, so a younger child can do less than a big
-- sister. Only the participants' points count, and they claim the reward. Everyone in the household still sees it.
-- This replaces the one minimum for every member (min_points_per_member).

create table public.goal_participants (
  goal_id uuid not null references public.goals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The points this participant must earn towards the goal before it is reached; null for none.
  min_points integer check (min_points >= 1),
  primary key (goal_id, user_id)
);
create index goal_participants_user_id_idx on public.goal_participants (user_id);

alter table public.goal_participants enable row level security;

-- Participants are set with their goal by add_shared_goal() and go with it.
revoke all on table public.goal_participants from anon, authenticated;
grant select on table public.goal_participants to authenticated;

create policy "Members can view who takes part in their household's goals"
  on public.goal_participants for select to authenticated
  using (
    exists (
      select 1 from public.goals g
        where g.id = goal_participants.goal_id and g.household_id = (select private.current_household_id())
    )
  );

-- Existing shared goals stay as they were: everyone in the household takes part, with the goal's minimum.
insert into public.goal_participants (goal_id, user_id, min_points)
  select g.id, m.user_id, g.min_points_per_member
  from public.goals g join public.household_members m on m.household_id = g.household_id
  where g.owner_id is null;

-- Shared goals are added only with their participants, by add_shared_goal(); personal ones stay a plain insert.
drop policy "Adults can add shared goals and personal ones for their household" on public.goals;
create policy "Adults can add personal goals for their household"
  on public.goals for insert to authenticated
  with check (
    household_id = (select private.current_household_id())
    and created_by = (select auth.uid())
    and not (select private.is_child((select auth.uid())))
    and exists (
      select 1 from public.household_members m
        where m.user_id = goals.owner_id and m.household_id = (select private.current_household_id())
    )
  );

-- Sets a shared goal for the chosen members of the household, each with an optional minimum:
-- participants = [{"user_id": "…", "min_points": 3 | null}, …]. Only adults can. Raises insufficient_privilege
-- (42501) for a child or someone outside the household, and check_violation (23514) for no participants, someone
-- listed twice, a minimum below 1, or minimums that together are more than the target. Returns the new goal's id.
create function public.add_shared_goal(title text, target_points integer, participants jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  household uuid := private.current_household_id();
  new_goal_id uuid;
begin
  if household is null or private.is_child(auth.uid()) then
    raise exception 'Only adults set goals' using errcode = '42501';
  end if;
  if jsonb_typeof(add_shared_goal.participants) is distinct from 'array'
    or jsonb_array_length(add_shared_goal.participants) = 0 then
    raise exception 'A shared goal needs someone to take part' using errcode = '23514';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(add_shared_goal.participants) as c (user_id uuid, min_points integer)
      where c.user_id is null or not exists (
        select 1 from public.household_members m where m.user_id = c.user_id and m.household_id = household
      )
  ) then
    raise exception 'Only members of the household take part' using errcode = '42501';
  end if;
  if (
    select count(distinct c.user_id)
      from jsonb_to_recordset(add_shared_goal.participants) as c (user_id uuid, min_points integer)
  ) <> jsonb_array_length(add_shared_goal.participants) then
    raise exception 'Someone is listed twice' using errcode = '23514';
  end if;
  if (
    select coalesce(sum(c.min_points), 0)
      from jsonb_to_recordset(add_shared_goal.participants) as c (user_id uuid, min_points integer)
  ) > add_shared_goal.target_points then
    raise exception 'The minimums together are more than the goal''s points' using errcode = '23514';
  end if;
  insert into public.goals (household_id, title, target_points)
    values (household, add_shared_goal.title, add_shared_goal.target_points)
    returning id into new_goal_id;
  insert into public.goal_participants (goal_id, user_id, min_points)
    select new_goal_id, c.user_id, c.min_points
      from jsonb_to_recordset(add_shared_goal.participants) as c (user_id uuid, min_points integer);
  return new_goal_id;
end;
$$;
revoke execute on function public.add_shared_goal(text, integer, jsonb) from public, anon;
grant execute on function public.add_shared_goal(text, integer, jsonb) to authenticated;

-- Replaced by the participants' own minimums.
drop function public.household_goals();
drop function private.goal_member_points(public.goals);
alter table public.goals drop column min_points_per_member;

-- The points that count towards a goal: those of shared tasks in its household done from when it was set until it
-- was claimed, by its participants for a shared goal and by its owner for a personal one. Security definer like
-- before (ADR 0004: children's goals count tasks they can't see), scoped by the goal row the caller could read.
create or replace function private.goal_points(goal public.goals)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(t.points), 0)::integer from public.tasks t
  where t.household_id = goal.household_id
    and not t.is_private
    and t.completed_at >= goal.created_at
    and t.completed_at <= coalesce(goal.claimed_at, 'infinity')
    and (
      t.completed_by = goal.owner_id
      or exists (
        select 1 from public.goal_participants gp where gp.goal_id = goal.id and gp.user_id = t.completed_by
      )
    );
$$;

-- What each participant of a shared goal has earned towards it, with their minimum, in the order they joined (same
-- points as goal_points()). A member leaves only by deleting their account, which removes them as a participant, and
-- their tasks no longer say who did them, so their points stop counting.
create function private.goal_participant_points(goal public.goals)
returns table (user_id uuid, display_name text, points integer, min_points integer, joined_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select gp.user_id, p.display_name, coalesce(sum(t.points), 0)::integer, gp.min_points, m.joined_at
  from public.goal_participants gp
  join public.household_members m on m.user_id = gp.user_id and m.household_id = goal.household_id
  left join public.profiles p on p.id = gp.user_id
  left join public.tasks t
    on t.household_id = goal.household_id
    and t.completed_by = gp.user_id
    and not t.is_private
    and t.completed_at >= goal.created_at
    and t.completed_at <= coalesce(goal.claimed_at, 'infinity')
  where gp.goal_id = goal.id
  group by gp.user_id, p.display_name, gp.min_points, m.joined_at;
$$;
revoke execute on function private.goal_participant_points(public.goals) from public;
grant execute on function private.goal_participant_points(public.goals) to authenticated;

-- A goal is reached when its points reach the target and every participant has earned their minimum, if they have
-- one.
create or replace function private.goal_is_reached(goal public.goals)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.goal_points(goal) >= goal.target_points
    and not exists (
      select 1 from private.goal_participant_points(goal) pp where pp.points < pp.min_points
    );
$$;

-- The household's goals with the points towards each, whether it is reached and the owner's display name, open goals
-- first (newest first), then claimed ones (most recently claimed first). Shared goals also list their participants
-- (`participants`: user_id, display_name, points, min_points). Security invoker, so Row Level Security scopes it.
create function public.household_goals()
returns table (
  id uuid,
  title text,
  target_points integer,
  owner_id uuid,
  owner_name text,
  created_at timestamptz,
  claimed_at timestamptz,
  points integer,
  reached boolean,
  participants jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select g.id, g.title, g.target_points, g.owner_id, p.display_name, g.created_at, g.claimed_at,
    private.goal_points(g), private.goal_is_reached(g),
    case when g.owner_id is null then (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'user_id', pp.user_id, 'display_name', pp.display_name, 'points', pp.points, 'min_points', pp.min_points
        )
        order by pp.joined_at, pp.user_id
      ), '[]'::jsonb)
      from private.goal_participant_points(g) pp
    ) end
  from public.goals g
  left join public.profiles p on p.id = g.owner_id
  order by g.claimed_at desc nulls first, g.created_at desc, g.id;
$$;
revoke execute on function public.household_goals() from public, anon;
grant execute on function public.household_goals() to authenticated;

-- Claims the reward of an open goal once it is reached (goal_is_reached()): a shared goal by one of its
-- participants, a personal goal by its owner. Raises no_data_found (P0002) if the user has no such open goal, and
-- check_violation (23514) if it isn't reached yet.
create or replace function public.claim_goal_reward(goal_id uuid)
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
      and (
        g.owner_id = auth.uid()
        or exists (
          select 1 from public.goal_participants gp where gp.goal_id = g.id and gp.user_id = auth.uid()
        )
      )
      and g.claimed_at is null
    for update;
  if goal.id is null then
    raise exception 'No open goal of yours with this id in your household' using errcode = 'P0002';
  end if;
  if not private.goal_is_reached(goal) then
    raise exception 'This goal has not been reached yet' using errcode = '23514';
  end if;
  update public.goals g set claimed_at = now(), claimed_by = auth.uid() where g.id = goal.id;
end;
$$;
