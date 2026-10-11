-- What children may do: add tasks only when allowed, without choosing points, and no goals. Run with
-- `npm run db:test` (needs Docker). Anna (adult) and Ben (child) share a household; Carol has her own.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carol@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select public.create_household('Carol''s flat');
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');
insert into public.tasks (title, type, points, for_children) values ('Feed the cat', 'physical', 2, true);

reset role;
insert into public.household_members (household_id, user_id, is_child)
  select household_id, '22222222-2222-2222-2222-222222222222', true from public.tasks where title = 'Feed the cat';
do $$
begin
  perform set_config('test.cat', id::text, true) from public.tasks where title = 'Feed the cat';
end
$$;
set local role authenticated;

-- Anna lets Ben add tasks; only adults decide that, and only for children in their household.
select throws_ok(
  $$ select public.set_member_can_add_tasks('11111111-1111-1111-1111-111111111111', true) $$,
  'P0002', null,
  'only children are allowed or not allowed to add tasks'
);
select throws_ok(
  $$ select public.set_member_can_add_tasks('33333333-3333-3333-3333-333333333333', true) $$,
  'P0002', null,
  'an adult cannot change someone in another household'
);
select lives_ok(
  $$ select public.set_member_can_add_tasks('22222222-2222-2222-2222-222222222222', true) $$,
  'an adult can let a child add tasks'
);
select throws_ok(
  $$ insert into public.tasks (title, type, points) values ('Dust', 'physical', null) $$,
  '42501', null,
  'an adult''s shared task needs points'
);

-- Ben adds a shared task and a private one, and can't touch Anna's.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok(
  $$ select public.set_member_can_add_tasks('22222222-2222-2222-2222-222222222222', false) $$,
  '42501', null,
  'a child cannot change what they may do'
);
select lives_ok(
  $$ insert into public.tasks (title, type, points, for_children, repeat_every_days)
     values ('Tidy my room', 'physical', null, true, 7) $$,
  'a child can add a shared task, which waits for points'
);
select lives_ok(
  $$ insert into public.tasks (title, type, points, for_children, is_private)
     values ('Read my book', 'physical', null, true, true) $$,
  'a child can add a private task'
);
do $$
begin
  perform set_config('test.room', id::text, true) from public.tasks where title = 'Tidy my room';
end
$$;
select lives_ok(
  format(
    $$ select public.update_task(%L, 'Tidy my room', 'And the desk', 'physical', 10::smallint, null, 7::smallint) $$,
    current_setting('test.room')
  ),
  'a child can edit their own task'
);
select results_eq(
  format('select description, points from public.tasks where id = %L', current_setting('test.room')),
  $$ values ('And the desk', null::smallint) $$,
  'a child''s edit does not give their task points'
);
select throws_ok(
  format(
    $$ select public.update_task(%L, 'Feed the dog', null, 'physical', 2::smallint, null, null) $$,
    current_setting('test.cat')
  ),
  'P0002', null,
  'a child cannot edit a task an adult added'
);
select throws_ok(
  format('select public.delete_task(%L)', current_setting('test.cat')),
  'P0002', null,
  'a child cannot delete a task an adult added'
);
select throws_ok(
  format('select public.award_task_points(%L, 10::smallint)', current_setting('test.room')),
  '42501', null,
  'a child cannot award points'
);
select lives_ok(
  format('select public.complete_task(%L, current_date)', current_setting('test.room')),
  'a child can mark their task done'
);

-- Anna awards the points; the next occurrence waits for points again.
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select results_eq(
  $$ select done, points from public.household_statistics(null)
     where user_id = '22222222-2222-2222-2222-222222222222' $$,
  $$ values (1, 0) $$,
  'a task waiting for points earns none yet'
);
select throws_ok(
  format('select public.award_task_points(%L, 11::smallint)', current_setting('test.room')),
  '23514', null,
  'points are from 1 to 10'
);
select lives_ok(
  format('select public.award_task_points(%L, 4::smallint)', current_setting('test.room')),
  'an adult can award the points of a child''s done task'
);
select results_eq(
  $$ select done, points from public.household_statistics(null)
     where user_id = '22222222-2222-2222-2222-222222222222' $$,
  $$ values (1, 4) $$,
  'the child earns the awarded points'
);
select throws_ok(
  format('select public.award_task_points(%L, 6::smallint)', current_setting('test.room')),
  'P0002', null,
  'points are awarded once'
);
select results_eq(
  format('select points from public.tasks where previous_task_id = %L', current_setting('test.room')),
  $$ values (null::smallint) $$,
  'the next occurrence of a child''s task waits for points again'
);
select throws_ok(
  format(
    $$ select public.update_task(%L, 'Feed the cat', null, 'physical', null, null, null) $$,
    current_setting('test.cat')
  ),
  'P0002', null,
  'an adult cannot take a shared task''s points away'
);

-- Only adults add and delete goals; Ben claims the personal goal Anna set for him.
insert into public.goals (title, target_points, owner_id)
  values ('New football', 4, '22222222-2222-2222-2222-222222222222');
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok(
  $$ insert into public.goals (title, target_points) values ('Ice cream', 3) $$,
  '42501', null,
  'a child cannot add a goal'
);
delete from public.goals where title = 'New football';
select is(
  (select count(*)::integer from public.goals where title = 'New football'),
  1, 'a child cannot delete a goal'
);
-- Ben does a 4-point task after the goal was set (now() is the same all through the transaction).
reset role;
insert into public.tasks (household_id, title, type, points, created_by, for_children, completed_at, completed_by)
  select household_id, 'Wash up', 'physical', 4, '11111111-1111-1111-1111-111111111111', true, now(),
    '22222222-2222-2222-2222-222222222222'
  from public.tasks where title = 'Feed the cat';
set local role authenticated;
select lives_ok(
  $$ select public.claim_goal_reward((select id from public.goals where title = 'New football')) $$,
  'a child claims the personal goal an adult set for them'
);
select is(
  (select claimed_by from public.goals where title = 'New football'),
  '22222222-2222-2222-2222-222222222222'::uuid,
  'the reward is the child''s'
);

select * from finish();
rollback;
