-- Households (families), their members and the tasks they share (ADR 0010).
-- A user belongs to at most one household. Households are created and joined only through
-- create_household() and join_household(), so a user can't add themselves to someone else's family.

-- Helpers used by policies and functions; `private` is not exposed through the API.
create schema private;
grant usage on schema private to authenticated;

-- 8 characters from 32 letters and digits without look-alikes (0/O, 1/I): easy to read out or type.
create function private.new_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', get_byte(bytes, i) % 32 + 1, 1), '' order by i)
  from extensions.gen_random_bytes(8) as bytes, generate_series(0, 7) as i;
$$;
revoke execute on function private.new_invite_code() from public;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 50 and name = btrim(name)),
  invite_code text not null unique default private.new_invite_code(),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80 and title = btrim(title)),
  type text not null check (type in ('physical', 'planning')),
  points smallint not null check (points between 1 and 10),
  -- Kept when the creator deletes their account, so the family's history stays intact.
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index tasks_household_id_created_at_idx on public.tasks (household_id, created_at desc);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.tasks enable row level security;

-- Security definer so policies on household_members can use it without recursing into themselves.
create function private.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select household_id from public.household_members where user_id = (select auth.uid());
$$;
revoke execute on function private.current_household_id() from public;
grant execute on function private.current_household_id() to authenticated;

-- Supabase grants every privilege to anon and authenticated by default; allow only what the app needs.
-- Tasks can't be edited or deleted yet, and created_by / created_at always come from their defaults.
revoke all on table public.households, public.household_members, public.tasks from anon, authenticated;
grant select on table public.households, public.household_members to authenticated;
grant select on table public.tasks to authenticated;
grant insert (household_id, title, type, points) on table public.tasks to authenticated;

create policy "Members can view their household"
  on public.households for select to authenticated
  using (id = (select private.current_household_id()));

create policy "Members can view their household's members"
  on public.household_members for select to authenticated
  using (household_id = (select private.current_household_id()));

create policy "Members can view their household's tasks"
  on public.tasks for select to authenticated
  using (household_id = (select private.current_household_id()));

create policy "Members can add tasks to their household"
  on public.tasks for insert to authenticated
  with check (
    household_id = (select private.current_household_id())
    and created_by = (select auth.uid())
  );

create policy "Users can view their household members' profiles"
  on public.profiles for select to authenticated
  using (
    id in (
      select user_id from public.household_members
      where household_id = (select private.current_household_id())
    )
  );

create function public.create_household(household_name text)
returns public.households
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_household public.households;
begin
  if auth.uid() is null then
    raise exception 'Log in to create a household' using errcode = '42501';
  end if;
  insert into public.households (name) values (household_name) returning * into new_household;
  -- Fails with unique_violation (23505) if the user is already in a household.
  insert into public.household_members (household_id, user_id) values (new_household.id, auth.uid());
  return new_household;
end;
$$;

-- Returns the joined household's id. Raises no_data_found (P0002) for an unknown code.
create function public.join_household(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Log in to join a household' using errcode = '42501';
  end if;
  select h.id into target_id from public.households h where h.invite_code = upper(btrim(join_household.invite_code));
  if target_id is null then
    raise exception 'No household has this invite code' using errcode = 'P0002';
  end if;
  insert into public.household_members (household_id, user_id) values (target_id, auth.uid());
  return target_id;
end;
$$;

revoke execute on function public.create_household(text), public.join_household(text) from public, anon;
grant execute on function public.create_household(text), public.join_household(text) to authenticated;
