-- Favourite tasks belong to one member each. Run with `npm run db:test` (needs Docker).
-- Anna and Ben share a household and Carl has his own.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carl@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select public.create_household('The Joneses');

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');
reset role;
insert into public.household_members (household_id, user_id)
  select household_id, '22222222-2222-2222-2222-222222222222' from public.household_members
  where user_id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;

select lives_ok(
  $$ insert into public.favourite_tasks (title_key) values ('take out trash') $$,
  'a member can star a task for their household'
);
select results_eq(
  $$ select title_key, household_id = (select private.current_household_id()) from public.favourite_tasks $$,
  $$ values ('take out trash', true) $$,
  'the member sees their favourite, in their household'
);
select throws_ok(
  $$ insert into public.favourite_tasks (title_key) values ('Take Out Trash') $$,
  '23514', null,
  'favourites are stored in lower case'
);
select throws_ok(
  $$ insert into public.favourite_tasks (user_id, household_id, title_key)
     values ('22222222-2222-2222-2222-222222222222', gen_random_uuid(), 'mow the lawn') $$,
  '42501', null,
  'a member cannot choose whose favourite it is or the household'
);
select throws_ok(
  $$ update public.favourite_tasks set title_key = 'changed' $$,
  '42501', null,
  'favourites cannot be edited'
);

-- Fifty tasks added twice push Anna's favourite, added once, out of the 50 most often added; it is still suggested.
insert into public.tasks (title, type, points) values ('Take out trash', 'physical', 1);
insert into public.tasks (title, type, points)
  select 'Chore ' || n, 'physical', 1 from generate_series(1, 50) n, generate_series(1, 2);
select results_eq(
  $$ select count(*)::integer, bool_or(title = 'Take out trash') from public.task_suggestions() $$,
  $$ values (51, true) $$,
  'favourites are suggested beyond the 50 most often added tasks'
);

-- Ben shares the household but not Anna's favourites.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is_empty($$ select 1 from public.favourite_tasks $$, 'other members'' favourites are invisible');
with deleted as (delete from public.favourite_tasks returning 1)
select is((select count(*)::int from deleted), 0, 'other members'' favourites cannot be removed');

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
with deleted as (delete from public.favourite_tasks returning 1)
select is((select count(*)::int from deleted), 1, 'a member can remove their own favourite');

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok(
  $$ select 1 from public.favourite_tasks $$,
  '42501', null,
  'visitors cannot read favourites'
);

select * from finish();
rollback;
