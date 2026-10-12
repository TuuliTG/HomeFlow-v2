-- Editing goals (ADR 0007): an adult changes an open goal's reward, points and who it is for, including its
-- participants and their minimums, with update_goal(). Its progress still counts from when it was set.

-- Checks the participants of a shared goal: [{"user_id": "…", "min_points": 3 | null}, …]. Raises
-- insufficient_privilege (42501) for someone outside the household, and check_violation (23514) for no participants,
-- someone listed twice, or minimums that together are more than the target (a minimum below 1 fails the table's
-- check on insert).
create function private.check_goal_participants(household uuid, target_points integer, participants jsonb)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(check_goal_participants.participants) is distinct from 'array'
    or jsonb_array_length(check_goal_participants.participants) = 0 then
    raise exception 'A shared goal needs someone to take part' using errcode = '23514';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(check_goal_participants.participants) as c (user_id uuid, min_points integer)
      where c.user_id is null or not exists (
        select 1 from public.household_members m
          where m.user_id = c.user_id and m.household_id = check_goal_participants.household
      )
  ) then
    raise exception 'Only members of the household take part' using errcode = '42501';
  end if;
  if (
    select count(distinct c.user_id)
      from jsonb_to_recordset(check_goal_participants.participants) as c (user_id uuid, min_points integer)
  ) <> jsonb_array_length(check_goal_participants.participants) then
    raise exception 'Someone is listed twice' using errcode = '23514';
  end if;
  if (
    select coalesce(sum(c.min_points), 0)
      from jsonb_to_recordset(check_goal_participants.participants) as c (user_id uuid, min_points integer)
  ) > check_goal_participants.target_points then
    raise exception 'The minimums together are more than the goal''s points' using errcode = '23514';
  end if;
end;
$$;
revoke execute on function private.check_goal_participants(uuid, integer, jsonb) from public;

-- Same as before, with the participants checked by check_goal_participants().
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
  insert into public.goals (household_id, title, target_points)
    values (household, add_shared_goal.title, add_shared_goal.target_points)
    returning id into new_goal_id;
  insert into public.goal_participants (goal_id, user_id, min_points)
    select new_goal_id, c.user_id, c.min_points
      from jsonb_to_recordset(add_shared_goal.participants) as c (user_id uuid, min_points integer);
  return new_goal_id;
end;
$$;

-- Changes an open goal of the household: its reward, points and who it is for. owner_id null makes it a shared goal
-- for `participants` (as in add_shared_goal(), replacing those it had); otherwise it is that member's personal goal
-- and `participants` is ignored. Only adults can. Raises insufficient_privilege (42501) for a child or an owner or
-- participant outside the household, no_data_found (P0002) if the household has no such open goal, and
-- check_violation (23514) as add_shared_goal() does or for a reward or points out of range.
create function public.update_goal(
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
revoke execute on function public.update_goal(uuid, text, integer, uuid, jsonb) from public, anon;
grant execute on function public.update_goal(uuid, text, integer, uuid, jsonb) to authenticated;
