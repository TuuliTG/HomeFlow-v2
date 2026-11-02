-- Asking a family member to do a task. Run with `npm run db:test` (needs Docker).
-- Anna and Ben (adults) and Carol (a child) share a household; Dave has his own.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carol@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'dave@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select public.create_household('Dave''s flat');
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');
insert into public.tasks (title, type, points) values ('Vacuum', 'physical', 3);
insert into public.tasks (title, type, points, for_children) values ('Feed the cat', 'physical', 2, true);
insert into public.tasks (title, type, points, is_private) values ('Buy a present', 'meta', null, true);
insert into public.tasks (title, type, points) values ('Dishes', 'physical', 1);
insert into public.tasks (title, type, points) values ('Water plants', 'physical', 1);

reset role;
insert into public.household_members (household_id, user_id, is_child)
  select household_id, '22222222-2222-2222-2222-222222222222'::uuid, false from public.tasks where title = 'Vacuum'
  union all
  select household_id, '33333333-3333-3333-3333-333333333333'::uuid, true from public.tasks where title = 'Vacuum';
do $$
begin
  perform set_config('test.vacuum', id::text, true) from public.tasks where title = 'Vacuum';
  perform set_config('test.cat', id::text, true) from public.tasks where title = 'Feed the cat';
  perform set_config('test.present', id::text, true) from public.tasks where title = 'Buy a present';
  perform set_config('test.dishes', id::text, true) from public.tasks where title = 'Dishes';
  perform set_config('test.plants', id::text, true) from public.tasks where title = 'Water plants';
end
$$;
set local role authenticated;

-- Anna asks Ben to vacuum and Carol to feed the cat.
select lives_ok(
  format($$ select public.request_task(%L, '22222222-2222-2222-2222-222222222222') $$, current_setting('test.vacuum')),
  'a member can ask another to do a task'
);
select lives_ok(
  format($$ select public.request_task(%L, '33333333-3333-3333-3333-333333333333') $$, current_setting('test.cat')),
  'a member can ask a child to do a task for children'
);
select throws_ok(
  format($$ select public.request_task(%L, '11111111-1111-1111-1111-111111111111') $$, current_setting('test.dishes')),
  '22023', null,
  'a member cannot ask themselves'
);
select throws_ok(
  format($$ select public.request_task(%L, '33333333-3333-3333-3333-333333333333') $$, current_setting('test.dishes')),
  'P0002', null,
  'a child cannot be asked to do an adults-only task'
);
select throws_ok(
  format($$ select public.request_task(%L, '22222222-2222-2222-2222-222222222222') $$, current_setting('test.present')),
  'P0002', null,
  'a private task cannot be asked of anyone'
);
select throws_ok(
  format($$ select public.request_task(%L, '44444444-4444-4444-4444-444444444444') $$, current_setting('test.dishes')),
  'P0002', null,
  'nobody outside the household can be asked'
);
select throws_ok(
  format(
    $$ insert into public.task_requests (task_id, requested_by, requested_for)
       values (%L, '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222') $$,
    current_setting('test.dishes')
  ),
  '42501', null,
  'requests are made only through the function'
);

-- Who sees the requests.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select results_eq(
  $$ select t.title, r.requested_by::text, r.answer
     from public.task_requests r join public.tasks t on t.id = r.task_id order by t.title $$,
  $$ values ('Feed the cat', '11111111-1111-1111-1111-111111111111', null::text),
            ('Vacuum', '11111111-1111-1111-1111-111111111111', null::text) $$,
  'the household sees who was asked to do which task'
);
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select results_eq(
  'select task_id::text from public.task_requests',
  format($$ values (%L) $$, current_setting('test.cat')),
  'a child sees only requests for tasks for children'
);
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select is_empty('select * from public.task_requests', 'other households see no requests');

-- Only Ben answers his request; accepting picks the task up for him.
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select throws_ok(
  format($$ select public.answer_task_request(%L, true) $$, current_setting('test.vacuum')),
  'P0002', null,
  'only the member asked can answer'
);
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok(
  format($$ select public.answer_task_request(%L, true) $$, current_setting('test.vacuum')),
  'the member asked can accept'
);
select results_eq(
  format($$ select t.picked_up_by::text, r.answer from public.tasks t join public.task_requests r on r.task_id = t.id
            where t.id = %L $$, current_setting('test.vacuum')),
  $$ values ('22222222-2222-2222-2222-222222222222', 'accepted') $$,
  'accepting picks the task up for the member asked'
);
select throws_ok(
  format($$ select public.answer_task_request(%L, false) $$, current_setting('test.vacuum')),
  'P0002', null,
  'a request is answered once'
);
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select throws_ok(
  format($$ select public.request_task(%L, '22222222-2222-2222-2222-222222222222') $$, current_setting('test.vacuum')),
  '55006', null,
  'a task someone else has picked up cannot be asked of anyone'
);

-- Carol declines; Anna clears the answer.
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select lives_ok(
  format($$ select public.answer_task_request(%L, false) $$, current_setting('test.cat')),
  'the member asked can decline'
);
select results_eq(
  format($$ select t.picked_up_by, r.answer from public.tasks t join public.task_requests r on r.task_id = t.id
            where t.id = %L $$, current_setting('test.cat')),
  $$ values (null::uuid, 'declined') $$,
  'declining leaves the task free'
);
select throws_ok(
  format($$ select public.cancel_task_request(%L) $$, current_setting('test.cat')),
  'P0002', null,
  'only whoever asked can cancel a request'
);
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok(
  format($$ select public.cancel_task_request(%L) $$, current_setting('test.cat')),
  'whoever asked can clear a declined request'
);
select is_empty(
  format($$ select * from public.task_requests where task_id = %L $$, current_setting('test.cat')),
  'a cleared request is gone'
);

-- Anna hands over a task she picked up.
select public.pick_up_task(current_setting('test.dishes')::uuid);
select public.request_task(current_setting('test.dishes')::uuid, '22222222-2222-2222-2222-222222222222');
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.answer_task_request(current_setting('test.dishes')::uuid, true);
select results_eq(
  format($$ select picked_up_by::text from public.tasks where id = %L $$, current_setting('test.dishes')),
  $$ values ('22222222-2222-2222-2222-222222222222') $$,
  'a member can hand over a task they picked up'
);

-- A request is settled once someone else picks the task up or it is done.
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.request_task(current_setting('test.cat')::uuid, '22222222-2222-2222-2222-222222222222');
select public.request_task(current_setting('test.plants')::uuid, '22222222-2222-2222-2222-222222222222');
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select public.pick_up_task(current_setting('test.cat')::uuid);
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.complete_task(current_setting('test.plants')::uuid, current_date);
select is_empty(
  format(
    $$ select * from public.task_requests where task_id in (%L, %L) $$,
    current_setting('test.cat'), current_setting('test.plants')
  ),
  'a request goes once someone else picks the task up or it is done'
);
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok(
  format($$ select public.answer_task_request(%L, true) $$, current_setting('test.plants')),
  'P0002', null,
  'a settled request cannot be accepted'
);

-- Ben picking up the task he was asked to do accepts the request; giving it back clears it.
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.tasks (title, type, points) values ('Dust', 'physical', 1);
select public.request_task(id, '22222222-2222-2222-2222-222222222222') from public.tasks where title = 'Dust';
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.pick_up_task(id) from public.tasks where title = 'Dust';
select results_eq(
  $$ select r.answer from public.task_requests r join public.tasks t on t.id = r.task_id where t.title = 'Dust' $$,
  $$ values ('accepted') $$,
  'picking up a task one was asked to do accepts the request'
);
select throws_ok(
  $$ select public.answer_task_request(id, false) from public.tasks where title = 'Dust' $$,
  'P0002', null,
  'a request accepted by picking the task up cannot be declined'
);
select public.put_back_task(id) from public.tasks where title = 'Dust';
select is_empty(
  $$ select * from public.task_requests r join public.tasks t on t.id = r.task_id where t.title = 'Dust' $$,
  'giving back a task one accepted clears the request'
);

-- Asking again replaces the earlier request.
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.tasks (title, type, points) values ('Mop', 'physical', 2);
select public.request_task(id, '22222222-2222-2222-2222-222222222222') from public.tasks where title = 'Mop';
select lives_ok(
  $$ select public.request_task(id, '22222222-2222-2222-2222-222222222222') from public.tasks where title = 'Mop' $$,
  'a member can ask again'
);
select results_eq(
  $$ select count(*)::int from public.task_requests r join public.tasks t on t.id = r.task_id where t.title = 'Mop' $$,
  $$ values (1) $$,
  'a task has one request at a time'
);

select * from finish();
rollback;
