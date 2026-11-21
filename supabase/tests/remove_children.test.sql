-- Removing a child without email. Run with `npm run db:test` (needs Docker). Anna added Ben, a child without email,
-- to her household; Dan is a child there with his own email; Carol has her own household.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222@child.homeflow.invalid'),
  ('33333333-3333-3333-3333-333333333333', 'carol@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'dan@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select public.create_household('Carol''s flat');
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');
insert into public.tasks (title, type, points) values ('Feed the cat', 'physical', 2);

set local role service_role;
select * from public.add_child('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Ben');
reset role;
insert into public.household_members (household_id, user_id, is_child)
  select household_id, '44444444-4444-4444-4444-444444444444', true from public.tasks where title = 'Feed the cat';
-- Ben was given the dishwasher and has done it, is given the bins, has picked up the cat (before he was a child)
-- and keeps a private task.
insert into public.tasks
  (household_id, title, type, points, created_by, for_children, assigned_to, completed_at, completed_by)
  select household_id, 'Empty the dishwasher', 'physical', 1, created_by, true,
    '22222222-2222-2222-2222-222222222222', now(), '22222222-2222-2222-2222-222222222222'
  from public.tasks where title = 'Feed the cat';
insert into public.tasks (household_id, title, type, points, created_by, for_children, assigned_to)
  select household_id, 'Take out the bins', 'physical', 1, created_by, true, '22222222-2222-2222-2222-222222222222'
  from public.tasks where title = 'Feed the cat';
update public.tasks set picked_up_by = '22222222-2222-2222-2222-222222222222', picked_up_at = now()
  where title = 'Feed the cat';
insert into public.tasks (household_id, title, type, is_private, for_children, created_by)
  select household_id, 'Ben''s homework', 'physical', true, true, '22222222-2222-2222-2222-222222222222'
    from public.tasks where title = 'Feed the cat';

-- Only an adult in the child's household removes them, and only a child without email.
set local role authenticated;
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select throws_ok(
  $$ select public.remove_child('22222222-2222-2222-2222-222222222222') $$,
  '42501', null,
  'a child cannot remove a child'
);
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select throws_ok(
  $$ select public.remove_child('22222222-2222-2222-2222-222222222222') $$,
  'P0002', null,
  'an adult cannot remove a child from another household'
);
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select throws_ok(
  $$ select public.remove_child('44444444-4444-4444-4444-444444444444') $$,
  'P0002', null,
  'a child with their own email is not removed'
);
select throws_ok(
  $$ select public.remove_child('11111111-1111-1111-1111-111111111111') $$,
  'P0002', null,
  'an adult cannot remove themselves'
);

-- Anna removes Ben.
select lives_ok(
  $$ select public.remove_child('22222222-2222-2222-2222-222222222222') $$,
  'an adult removes a child without email from their household'
);
reset role;
select is_empty(
  $$ select 1 from auth.users where id = '22222222-2222-2222-2222-222222222222' $$,
  'the child''s login goes'
);
select is_empty(
  $$ select 1 from public.household_members where user_id = '22222222-2222-2222-2222-222222222222' $$,
  'the child leaves the household'
);
select is_empty(
  $$ select 1 from public.tasks where title = 'Ben''s homework' $$,
  'the child''s private tasks go'
);
select is_empty(
  $$ select 1 from public.tasks where title = 'Take out the bins' $$,
  'the child''s open chores go'
);
select results_eq(
  $$ select picked_up_by, picked_up_at from public.tasks where title = 'Feed the cat' $$,
  $$ values (null::uuid, null::timestamptz) $$,
  'tasks the child picked up are put back'
);
select results_eq(
  $$ select completed_at is not null, completed_by, picked_up_by, assigned_to from public.tasks
     where title = 'Empty the dishwasher' $$,
  $$ values (true, null::uuid, null::uuid, null::uuid) $$,
  'tasks the child did stay done, by nobody'
);
select results_eq(
  $$ select count(*)::int from public.household_members $$,
  $$ values (3) $$,
  'the other members stay'
);

select * from finish();
rollback;
