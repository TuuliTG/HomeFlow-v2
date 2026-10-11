-- Children and tasks available for them. Run with `npm run db:test` (needs Docker).
-- Anna and Ben share a household and Anna marks Ben as a child; Carol has her own household.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carol@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select public.create_household('Carol''s flat');

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');
insert into public.tasks (title, type, points) values ('Pay the bills', 'meta', 3);
insert into public.tasks (title, type, points, for_children, repeat_every_days)
  values ('Feed the cat', 'physical', 2, true, 1);
insert into public.tasks (title, type, points) values ('Mow the lawn', 'physical', 5);

-- Ben joins and, before he is a child, picks up an adults-only task and adds a private one.
reset role;
insert into public.household_members (household_id, user_id)
  select household_id, '22222222-2222-2222-2222-222222222222' from public.tasks where title = 'Pay the bills';
do $$
begin
  perform set_config('test.bills', id::text, true) from public.tasks where title = 'Pay the bills';
  perform set_config('test.cat', id::text, true) from public.tasks where title = 'Feed the cat';
  perform set_config('test.lawn', id::text, true) from public.tasks where title = 'Mow the lawn';
end
$$;
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.pick_up_task(current_setting('test.bills')::uuid);
select public.set_task_reminder(current_setting('test.bills')::uuid, now() + interval '1 day');
insert into public.tasks (title, type, points, is_private) values ('Read a book', 'physical', null, true);

select results_eq(
  $$ select bool_or(is_child) from public.household_members $$,
  $$ values (false) $$,
  'members join as adults'
);

-- Anna marks Ben as a child.
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok(
  $$ select public.set_member_is_child('22222222-2222-2222-2222-222222222222', true) $$,
  'an adult can mark another member as a child'
);
select results_eq(
  $$ select user_id::text, is_child from public.household_members order by user_id $$,
  $$ values ('11111111-1111-1111-1111-111111111111', false), ('22222222-2222-2222-2222-222222222222', true) $$,
  'the household sees who is a child'
);
select results_eq(
  $$ select picked_up_by from public.tasks where title = 'Pay the bills' $$,
  $$ values (null::uuid) $$,
  'a new child gives back the adults-only tasks they picked up'
);
select throws_ok(
  $$ select public.set_member_is_child('11111111-1111-1111-1111-111111111111', true) $$,
  'P0002', null,
  'an adult cannot change themselves'
);
select throws_ok(
  $$ select public.set_member_is_child('33333333-3333-3333-3333-333333333333', true) $$,
  'P0002', null,
  'an adult cannot change someone outside their household'
);
select results_eq(
  $$ select count(*)::integer from public.tasks $$,
  $$ values (3) $$,
  'adults see every shared task'
);

-- Ben, now a child, sees and acts only on tasks available for children.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select results_eq(
  $$ select title, for_children from public.tasks order by title $$,
  $$ values ('Feed the cat', true), ('Read a book', true) $$,
  'a child sees only tasks available for children, keeping their own private ones'
);
select results_eq(
  $$ select count(*)::integer from public.task_reminders $$,
  $$ values (0) $$,
  'a new child loses their reminders for adults-only tasks'
);
select throws_ok(
  $$ select public.set_member_is_child('22222222-2222-2222-2222-222222222222', false) $$,
  '42501', null,
  'a child cannot make themselves an adult'
);
select throws_ok(
  $$ select public.set_member_is_child('11111111-1111-1111-1111-111111111111', true) $$,
  '42501', null,
  'a child cannot change other members'
);
select throws_ok(
  format('select public.pick_up_task(%L)', current_setting('test.lawn')),
  'P0002', null,
  'a child cannot pick up an adults-only task'
);
select throws_ok(
  format('select public.complete_task(%L, current_date)', current_setting('test.lawn')),
  'P0002', null,
  'a child cannot mark an adults-only task done'
);
select throws_ok(
  format(
    $$ select public.update_task(%L, 'Hacked', null, 'meta', 2::smallint, null, null, true) $$,
    current_setting('test.lawn')
  ),
  'P0002', null,
  'a child cannot edit an adults-only task'
);
select throws_ok(
  format('select public.delete_task(%L)', current_setting('test.lawn')),
  'P0002', null,
  'a child cannot delete an adults-only task'
);
select throws_ok(
  format(
    $$ select public.update_task(%L, 'Feed the cat', null, 'physical', 2::smallint, null, 1::smallint, false) $$,
    current_setting('test.cat')
  ),
  '42501', null,
  'a child cannot make a task adults-only'
);
select throws_ok(
  $$ insert into public.tasks (title, type, points) values ('Hide the sweets', 'meta', 1) $$,
  '42501', null,
  'a child cannot add an adults-only task'
);
select lives_ok(
  $$ insert into public.tasks (title, type, points, for_children) values ('Tidy my room', 'physical', 2, true) $$,
  'a child can add a task available for children'
);
select results_eq(
  $$ select title, for_children from public.task_suggestions() order by title $$,
  $$ values ('Feed the cat', true), ('Read a book', true), ('Tidy my room', true) $$,
  'a child is only offered tasks available for children to add again'
);
select lives_ok(
  format('select public.pick_up_task(%L)', current_setting('test.cat')),
  'a child can pick up a task available for children'
);
select lives_ok(
  format('select public.set_task_reminder(%L, now() + interval ''1 day'')', current_setting('test.cat')),
  'a child can set a reminder for it'
);

-- Anna makes "Feed the cat" adults-only, which takes it back from Ben, then makes it available again.
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok(
  format(
    $$ select public.update_task(%L, 'Feed the cat', null, 'physical', 2::smallint, null, 1::smallint, false) $$,
    current_setting('test.cat')
  ),
  'an adult can make a task adults-only'
);
select results_eq(
  format('select picked_up_by, for_children from public.tasks where id = %L', current_setting('test.cat')),
  $$ values (null::uuid, false) $$,
  'making a task adults-only puts it back from the child who picked it up'
);
select lives_ok(
  format(
    $$ select public.update_task(%L, 'Feed the cat', null, 'physical', 2::smallint, null, 1::smallint) $$,
    current_setting('test.cat')
  ),
  'an edit without for_children is still accepted'
);
select lives_ok(
  format(
    $$ select public.update_task(%L, 'Feed the cat', null, 'physical', 2::smallint, null, 1::smallint, true) $$,
    current_setting('test.cat')
  ),
  'an adult can make a task available for children'
);

-- Ben does it; the next occurrence stays available for children.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.complete_task(current_setting('test.cat')::uuid, current_date);
select results_eq(
  format(
    'select for_children, completed_at is null from public.tasks where previous_task_id = %L',
    current_setting('test.cat')
  ),
  $$ values (true, true) $$,
  'the next occurrence of a task done by a child stays available for children'
);

select * from finish();
rollback;
