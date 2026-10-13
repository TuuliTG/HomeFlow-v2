-- One open goal at a time (ADR 0007): each member takes part in at most one open shared goal and has at most one
-- open personal goal, so the same points don't pay for several rewards at once. The next goal can be set once the
-- current one is claimed or deleted, and it counts from zero. Goals that were already open stay as they are.

-- Keeps two adults from setting goals for the same member at the same moment: both wait for the household's lock.
create function private.lock_household_goals(household uuid)
returns void
language sql
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended('household_goals:' || household::text, 0));
$$;
revoke execute on function private.lock_household_goals(uuid) from public;

-- Raises unique_violation (23505) if someone in `participants` ([{"user_id": "…"}, …]) already takes part in
-- another open shared goal of the household. Those already taking part in `goal_id` (null for a new goal) aren't
-- checked, so a goal set before this rule can still be changed.
create function private.check_one_open_shared_goal(household uuid, goal_id uuid, participants jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.lock_household_goals(household);
  if exists (
    select 1
      from jsonb_to_recordset(check_one_open_shared_goal.participants) as c (user_id uuid)
      join public.goal_participants gp on gp.user_id = c.user_id
      join public.goals g on g.id = gp.goal_id
      where g.household_id = check_one_open_shared_goal.household
        and g.claimed_at is null
        and g.id is distinct from check_one_open_shared_goal.goal_id
        and not exists (
          select 1 from public.goal_participants own
            where own.goal_id = check_one_open_shared_goal.goal_id and own.user_id = c.user_id
        )
  ) then
    raise exception 'Someone taking part already has an open shared goal' using errcode = '23505';
  end if;
end;
$$;
revoke execute on function private.check_one_open_shared_goal(uuid, uuid, jsonb) from public;

-- Personal goals are added with a plain insert (as the insert policy allows) and changed by update_goal(): either
-- way, a member gets a new personal goal only while they have no other open one.
create function private.check_one_open_personal_goal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is null or new.claimed_at is not null
    or (tg_op = 'UPDATE' and new.owner_id is not distinct from old.owner_id) then
    return new;
  end if;
  -- An owner outside the household is left for the insert policy to refuse, revealing nothing about their goals.
  if not exists (
    select 1 from public.household_members m where m.user_id = new.owner_id and m.household_id = new.household_id
  ) then
    return new;
  end if;
  perform private.lock_household_goals(new.household_id);
  if exists (
    select 1 from public.goals g
      where g.household_id = new.household_id and g.owner_id = new.owner_id and g.claimed_at is null
        and g.id <> new.id
  ) then
    raise exception 'This member already has an open personal goal' using errcode = '23505';
  end if;
  return new;
end;
$$;
revoke execute on function private.check_one_open_personal_goal() from public;

create trigger goals_one_open_personal_goal
  before insert or update of owner_id on public.goals
  for each row execute function private.check_one_open_personal_goal();

-- Same as before, also checking that no participant already has an open shared goal.
create or replace function public.add_shared_goal(title text, target_points integer, participants jsonb)
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
  perform private.check_goal_participants(household, add_shared_goal.target_points, add_shared_goal.participants);
  perform private.check_one_open_shared_goal(household, null, add_shared_goal.participants);
  insert into public.goals (household_id, title, target_points)
    values (household, add_shared_goal.title, add_shared_goal.target_points)
    returning id into new_goal_id;
  insert into public.goal_participants (goal_id, user_id, min_points)
    select new_goal_id, c.user_id, c.min_points
      from jsonb_to_recordset(add_shared_goal.participants) as c (user_id uuid, min_points integer);
  return new_goal_id;
end;
$$;

-- Same as before, also checking that no new participant already has an open shared goal, and (by the trigger on
-- goals) that a new owner has no other open personal goal. Raises unique_violation (23505) for either.
create or replace function public.update_goal(
  goal_id uuid, title text, target_points integer, owner_id uuid, participants jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  household uuid := private.current_household_id();
begin
  if household is null or private.is_child(auth.uid()) then
    raise exception 'Only adults change goals' using errcode = '42501';
  end if;
  -- The row lock keeps the goal from being claimed while it changes.
  perform 1 from public.goals g
    where g.id = update_goal.goal_id and g.household_id = household and g.claimed_at is null
    for update;
  if not found then
    raise exception 'No open goal with this id in your household' using errcode = 'P0002';
  end if;
  if update_goal.owner_id is null then
    perform private.check_goal_participants(household, update_goal.target_points, update_goal.participants);
    perform private.check_one_open_shared_goal(household, update_goal.goal_id, update_goal.participants);
  elsif not exists (
    select 1 from public.household_members m where m.user_id = update_goal.owner_id and m.household_id = household
  ) then
    raise exception 'A personal goal is for a member of the household' using errcode = '42501';
  end if;
  update public.goals g
    set title = update_goal.title, target_points = update_goal.target_points, owner_id = update_goal.owner_id
    where g.id = update_goal.goal_id;
  delete from public.goal_participants gp where gp.goal_id = update_goal.goal_id;
  if update_goal.owner_id is null then
    insert into public.goal_participants (goal_id, user_id, min_points)
      select update_goal.goal_id, c.user_id, c.min_points
        from jsonb_to_recordset(update_goal.participants) as c (user_id uuid, min_points integer);
  end if;
end;
$$;
