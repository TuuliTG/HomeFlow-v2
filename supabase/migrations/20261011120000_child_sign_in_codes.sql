-- Child accounts without email (ADR 0003): an adult adds a child to the household, and the child signs in on their
-- own device with a one-time code the adult reads out. The add-child Edge Function creates the child's login (with an
-- address that receives no mail) and calls add_child(); the child-sign-in Edge Function takes the code with
-- take_child_sign_in_code() and turns it into a session.

-- Members an adult added this way. Only they get sign-in codes, so an adult can't sign in as someone who has their own
-- email and password.
alter table public.household_members add column signs_in_with_code boolean not null default false;

-- One code per child at a time, stored hashed: it is as good as a password while it lasts.
create table private.child_sign_in_codes (
  child_id uuid primary key references auth.users (id) on delete cascade,
  code_hash bytea not null unique,
  expires_at timestamptz not null
);
alter table private.child_sign_in_codes enable row level security;
revoke all on table private.child_sign_in_codes from public, anon, authenticated;

-- A code is written like an invite code; dashes, spaces and case don't matter.
create function private.child_sign_in_code_hash(code text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select extensions.digest(upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g')), 'sha256');
$$;
revoke execute on function private.child_sign_in_code_hash(text) from public;

-- Replaces the child's code with a new one that works once, for 15 minutes.
create function private.issue_child_sign_in_code(child uuid)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_code text := private.new_invite_code();
  new_expiry timestamptz := now() + interval '15 minutes';
begin
  insert into private.child_sign_in_codes (child_id, code_hash, expires_at)
  values (child, private.child_sign_in_code_hash(new_code), new_expiry)
  on conflict on constraint child_sign_in_codes_pkey
    do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at;
  return query select new_code, new_expiry;
end;
$$;
revoke execute on function private.issue_child_sign_in_code(uuid) from public;

-- The adult's household, if they are an adult in one. Locks their membership, like set_member_is_child(), so they
-- can't be made a child halfway through.
create function private.adult_household_id(adult uuid)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select m.household_id from public.household_members m where m.user_id = adult and not m.is_child for share;
$$;
revoke execute on function private.adult_household_id(uuid) from public;

-- For the add-child Edge Function only, after it has created the child's login: adds them to the adult's household
-- as a child with their name and returns their first code. Raises insufficient_privilege (42501) unless the adult is
-- an adult in a household.
create function public.add_child(adult_id uuid, child_id uuid, display_name text)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  household uuid := private.adult_household_id(adult_id);
begin
  if household is null then
    raise exception 'Only an adult in a household can add a child' using errcode = '42501';
  end if;
  insert into public.profiles (id, display_name) values (child_id, add_child.display_name);
  insert into public.household_members (household_id, user_id, is_child, signs_in_with_code)
  values (household, child_id, true, true);
  return query select * from private.issue_child_sign_in_code(child_id);
end;
$$;
revoke execute on function public.add_child(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.add_child(uuid, uuid, text) to service_role;

-- A new code for a child an adult added, e.g. on a new device or after logging out; any earlier code stops working.
-- Raises insufficient_privilege (42501) for a child, and no_data_found (P0002) for anyone but such a member of the
-- adult's household.
create function public.new_child_sign_in_code(child_id uuid)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  household uuid := private.adult_household_id(auth.uid());
begin
  if household is null then
    raise exception 'Only an adult in the household can make a sign-in code' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.household_members m
      where m.user_id = new_child_sign_in_code.child_id and m.household_id = household and m.signs_in_with_code
  ) then
    raise exception 'No child with this id signs in with a code in your household' using errcode = 'P0002';
  end if;
  return query select * from private.issue_child_sign_in_code(new_child_sign_in_code.child_id);
end;
$$;
revoke execute on function public.new_child_sign_in_code(uuid) from public, anon;
grant execute on function public.new_child_sign_in_code(uuid) to authenticated;

-- For the child-sign-in Edge Function only: uses up a code that is still valid and returns whose it is, or null.
-- Expired codes are removed on the way.
create function public.take_child_sign_in_code(code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  child uuid;
begin
  delete from private.child_sign_in_codes c where c.expires_at <= now();
  delete from private.child_sign_in_codes c where c.code_hash = private.child_sign_in_code_hash(code)
    returning c.child_id into child;
  return child;
end;
$$;
revoke execute on function public.take_child_sign_in_code(text) from public, anon, authenticated;
grant execute on function public.take_child_sign_in_code(text) to service_role;

-- The invite code is for adults: a child could otherwise join again with an account of their own and arrive as an
-- adult. Members read their household without it and adults get it from household_invite_code().
revoke select on table public.households from authenticated;
grant select (id, name, created_at) on table public.households to authenticated;

-- The user's household's invite code, or null for a child or someone without a household.
create function public.household_invite_code()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select h.invite_code from public.households h
    where h.id = (select private.current_household_id()) and not private.is_child(auth.uid());
$$;
revoke execute on function public.household_invite_code() from public, anon;
grant execute on function public.household_invite_code() to authenticated;
