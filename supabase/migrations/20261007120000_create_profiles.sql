-- One profile per signed-up user. Holds only a display name (data minimisation, see ADR 0009);
-- the email address stays in Supabase Auth. Deleting the auth user deletes the profile.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (char_length(display_name) between 1 and 50 and display_name = btrim(display_name)),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Supabase grants every privilege on new tables to anon and authenticated by default; narrow that
-- to what the app needs. Profiles are removed only through account deletion (cascade).
revoke all on table public.profiles from anon, authenticated;
grant select, insert, update on table public.profiles to authenticated;

create policy "Users can view their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
