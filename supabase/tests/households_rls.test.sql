-- Households, membership and shared tasks. Run with `npm run db:test` (needs Docker).
-- Anna and Ben share a household; Carol has her own and must never see theirs.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carol@example.com');
insert into public.profiles (id, display_name) values
  ('11111111-1111-1111-1111-111111111111', 'Anna'),
  ('22222222-2222-2222-2222-222222222222', 'Ben'),
  ('33333333-3333-3333-3333-333333333333', 'Carol');

set local role authenticated;

-- Anna creates a household.
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok(
  $$ select public.create_household('The Smiths') $$,
  'a user can create a household'
);
select results_eq(
  $$ select name from public.households $$,
  $$ values ('The Smiths') $$,
  'the creator sees the new household'
);
select results_eq(
  $$ select user_id from public.household_members $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid) $$,
  'the creator is its first member'
);
select matches(
  (select invite_code from public.households),
  '^[A-HJ-NP-Z2-9]{8}$',
  'the household gets an 8-character invite code without look-alike characters'
);
select throws_ok(
  $$ select public.create_household('Second home') $$,
  '23505', null,
  'a user can be in only one household'
);
select throws_ok(
  $$ select public.create_household(' Spaces ') $$,
  '23514', null,
  'a household name with surrounding spaces is rejected'
);
select lives_ok(
  $$ insert into public.tasks (household_id, title, type, points)
     select id, 'Book dentist', 'planning', 5 from public.households $$,
  'a member can add a task to their household'
);
select results_eq(
  $$ select created_by from public.tasks $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid) $$,
  'a new task records who created it'
);
select throws_ok(
  $$ insert into public.tasks (household_id, title, type, points, created_by)
     select id, 'Sneaky', 'physical', 3, '22222222-2222-2222-2222-222222222222' from public.households $$,
  '42501', null,
  'a task cannot be credited to someone else'
);
select throws_ok(
  $$ insert into public.tasks (household_id, title, type, points)
     select id, 'Dishes', 'physical', 11 from public.households $$,
  '23514', null,
  'task points above 10 are rejected'
);
select throws_ok(
  $$ insert into public.tasks (household_id, title, type, points)
     select id, 'Dishes', 'chores', 3 from public.households $$,
  '23514', null,
  'an unknown task type is rejected'
);
select throws_ok(
  $$ insert into public.tasks (household_id, title, type, points)
     select id, '', 'physical', 3 from public.households $$,
  '23514', null,
  'an empty task title is rejected'
);

-- Carol creates her own household.
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select lives_ok($$ select public.create_household('Carol''s flat') $$, 'another user creates a household');

-- Ben, not yet a member of any household.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is_empty($$ select 1 from public.households $$, 'a non-member sees no households');
select is_empty($$ select 1 from public.tasks $$, 'a non-member sees no tasks');
select results_eq(
  $$ select display_name from public.profiles $$,
  $$ values ('Ben') $$,
  'a user without a household sees only their own profile'
);
select throws_ok(
  $$ insert into public.household_members (household_id, user_id)
     values ((select id from public.households limit 1), '22222222-2222-2222-2222-222222222222') $$,
  '42501', null,
  'membership cannot be added directly, only with an invite code'
);
select throws_ok(
  $$ select public.join_household('WRONG123') $$,
  'P0002', null,
  'an unknown invite code is rejected'
);

-- Look up Anna's household as the database owner, as if she had shared its code.
reset role;
do $$
begin
  perform set_config('test.anna_code', invite_code, true), set_config('test.anna_household', id::text, true)
    from public.households where name = 'The Smiths';
end
$$;
set local role authenticated;

select lives_ok(
  format('select public.join_household(%L)', ' ' || lower(current_setting('test.anna_code')) || ' '),
  'a user can join a household with its invite code, ignoring case and spaces'
);
select results_eq(
  $$ select name from public.households $$,
  $$ values ('The Smiths') $$,
  'a member sees only their own household'
);
select results_eq(
  $$ select title from public.tasks $$,
  $$ values ('Book dentist') $$,
  'a member sees the tasks of their household'
);
select results_eq(
  $$ select display_name from public.profiles order by display_name $$,
  $$ values ('Anna'), ('Ben') $$,
  'members see each other''s display names, but no one else''s'
);
select throws_ok(
  $$ update public.tasks set points = 10 $$,
  '42501', null,
  'tasks cannot be edited yet'
);
select throws_ok(
  $$ delete from public.tasks $$,
  '42501', null,
  'tasks cannot be deleted yet'
);
select throws_ok(
  $$ update public.households set name = 'Hacked' $$,
  '42501', null,
  'households cannot be changed directly'
);

-- Carol must not reach Anna and Ben's household.
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select results_eq(
  $$ select title from public.tasks $$,
  $$ select title from public.tasks where false $$,
  'another household''s tasks are invisible'
);
select results_eq(
  $$ select count(*)::int from public.household_members $$,
  $$ values (1) $$,
  'another household''s members are invisible'
);
select throws_ok(
  $$ insert into public.tasks (household_id, title, type, points)
     values (current_setting('test.anna_household')::uuid, 'Sneaky', 'physical', 3) $$,
  '42501', null,
  'a user cannot add tasks to another household'
);

-- Visitors who are not logged in.
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok($$ select * from public.tasks $$, '42501', null, 'visitors cannot read tasks');
select throws_ok(
  $$ select public.create_household('Visitors') $$,
  '42501', null,
  'visitors cannot create households'
);

-- Deleting an account removes the membership but keeps the household's tasks.
reset role;
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
select results_eq(
  $$ select title, created_by from public.tasks $$,
  $$ values ('Book dentist', null::uuid) $$,
  'tasks stay with the household when their creator deletes their account'
);

select * from finish();
rollback;
