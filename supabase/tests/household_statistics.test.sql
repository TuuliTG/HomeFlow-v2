-- Household statistics. Run with `npm run db:test` (needs Docker).
-- Anna and Ben share a household and Carl has his own; each does and adds a few tasks. Dave added a task in Carl's
-- household before moving to Anna's.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carl@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'dave@example.com');
insert into public.profiles (id, display_name) values
  ('11111111-1111-1111-1111-111111111111', 'Anna'),
  ('22222222-2222-2222-2222-222222222222', 'Ben');

set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select public.create_household('The Joneses');
insert into public.tasks (title, type, points) values ('Mow the lawn', 'physical', 3);

reset role;
insert into public.household_members (household_id, user_id)
  select household_id, '44444444-4444-4444-4444-444444444444' from public.tasks where title = 'Mow the lawn';
set local role authenticated;
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
insert into public.tasks (title, type, points) values ('Fix the fence', 'physical', 5);

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');
insert into public.tasks (title, type, points) values ('Vacuum', 'physical', 3), ('Book dentist', 'meta', 2);
insert into public.tasks (title, type, points, is_private) values ('Buy a present', 'meta', null, true);

reset role;
insert into public.household_members (household_id, user_id)
  select household_id, '22222222-2222-2222-2222-222222222222' from public.tasks where title = 'Vacuum';
-- Dave moves to the Smiths; Ben did the vacuuming last month; Anna did her private task today.
update public.household_members set household_id = (select household_id from public.tasks where title = 'Vacuum')
  where user_id = '44444444-4444-4444-4444-444444444444';
update public.tasks
  set completed_by = '22222222-2222-2222-2222-222222222222', completed_at = now() - interval '40 days'
  where title = 'Vacuum';
update public.tasks
  set completed_by = '11111111-1111-1111-1111-111111111111', completed_at = now()
  where title = 'Buy a present';
update public.tasks set created_at = now() - interval '40 days' where title = 'Vacuum';
set local role authenticated;

select results_eq(
  $$ select display_name, done, points, created from public.household_statistics(null) $$,
  $$ values ('Anna', 0, 0, 2), ('Ben', 1, 3, 0), (null, 0, 0, 0) $$,
  'counts shared tasks each member did, their points and the tasks they added, with their names, leaving out private tasks'
);
select results_eq(
  $$ select user_id::text, done, created from public.household_statistics(now() - interval '7 days') $$,
  $$ values
    ('11111111-1111-1111-1111-111111111111', 0, 1),
    ('22222222-2222-2222-2222-222222222222', 0, 0),
    ('44444444-4444-4444-4444-444444444444', 0, 0) $$,
  'counts only what was done or added since the given time'
);

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select results_eq(
  $$ select user_id::text, done, created from public.household_statistics(null) $$,
  $$ values
    ('11111111-1111-1111-1111-111111111111', 0, 2),
    ('22222222-2222-2222-2222-222222222222', 1, 0),
    ('44444444-4444-4444-4444-444444444444', 0, 0) $$,
  'every member sees the same statistics'
);
-- Even without Row Level Security (e.g. the service role), tasks from Dave's earlier household don't count.
reset role;
select results_eq(
  $$ select done, created from public.household_statistics(null)
     where user_id = '44444444-4444-4444-4444-444444444444' $$,
  $$ values (0, 0) $$,
  'what a member did in an earlier household does not count'
);
set local role authenticated;

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select results_eq(
  $$ select user_id::text, done, created from public.household_statistics(null) $$,
  $$ values ('33333333-3333-3333-3333-333333333333', 0, 1) $$,
  'other households are left out'
);

reset role;
set local role anon;
select throws_ok(
  $$ select * from public.household_statistics(null) $$,
  '42501', null,
  'logged-out visitors cannot read statistics'
);

select * from finish();
rollback;
