-- Row Level Security for public.profiles. Run with `npx supabase test db` (needs Docker).
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com');
insert into public.profiles (id, display_name)
  values ('22222222-2222-2222-2222-222222222222', 'Ben');

-- Act as Anna.
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.profiles (id, display_name) values ('11111111-1111-1111-1111-111111111111', 'Anna') $$,
  'a user can create their own profile'
);
select throws_ok(
  $$ insert into public.profiles (id, display_name) values ('22222222-2222-2222-2222-222222222222', 'Hacked') $$,
  '42501', null,
  'a user cannot create a profile for someone else'
);
select results_eq(
  $$ select display_name from public.profiles $$,
  $$ values ('Anna') $$,
  'a user sees only their own profile'
);
select lives_ok(
  $$ update public.profiles set display_name = 'Anna K' where id = '11111111-1111-1111-1111-111111111111' $$,
  'a user can rename themselves'
);
update public.profiles set display_name = 'Hacked' where id = '22222222-2222-2222-2222-222222222222';
select throws_ok(
  $$ delete from public.profiles where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'profiles cannot be deleted directly'
);
select throws_ok(
  $$ update public.profiles set display_name = '' where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'an empty display name is rejected'
);
select throws_ok(
  $$ update public.profiles set display_name = ' Anna ' where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'a display name with surrounding spaces is rejected'
);

-- Act as a visitor who is not logged in.
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok(
  $$ select * from public.profiles $$,
  '42501', null,
  'visitors who are not logged in cannot read profiles'
);

reset role;
select results_eq(
  $$ select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222' $$,
  $$ values ('Ben') $$,
  'a user cannot rename someone else'
);
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
select is_empty(
  $$ select 1 from public.profiles where id = '11111111-1111-1111-1111-111111111111' $$,
  'deleting the account deletes the profile'
);

select * from finish();
rollback;
