-- Tasks default to the creator's household. Run with `npm run db:test` (needs Docker).
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');

select lives_ok(
  $$ insert into public.tasks (title, type, points) values ('Water plants', 'physical', 2) $$,
  'a member can add a task without naming the household'
);
select results_eq(
  $$ select t.household_id from public.tasks t $$,
  $$ select id from public.households $$,
  'the task goes to the creator''s household'
);

-- Ben is not in any household.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok(
  $$ insert into public.tasks (title, type, points) values ('Sneaky', 'physical', 3) $$,
  '23502', null,
  'a user without a household cannot add tasks'
);

select * from finish();
rollback;
