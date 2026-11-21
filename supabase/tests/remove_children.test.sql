-- Removing a child without email. Run with `npm run db:test` (needs Docker). Anna added Ben, a child without email,
-- to her household; Dan is a child there with his own email; Carol has her own household.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

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
insert into public.tasks (title, type, points, for_children) values ('Feed the cat', 'physical', 2, true);

set local role service_role;
select * from public.add_child('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Ben');
reset role;
insert into public.household_members (household_id, user_id, is_child)
  select household_id, '44444444-4444-4444-4444-444444444444', true from public.tasks where title = 'Feed the cat';
-- Ben has picked up the cat and keeps a private task.
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
select results_eq(
  $$ select picked_up_by, picked_up_at from public.tasks where title = 'Feed the cat' $$,
  $$ values (null::uuid, null::timestamptz) $$,
  'tasks the child picked up are put back'
);
select results_eq(
  $$ select count(*)::int from public.household_members $$,
  $$ values (3) $$,
  'the other members stay'
);

select * from finish();
rollback;
