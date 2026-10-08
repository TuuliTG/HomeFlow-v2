-- Picking up and putting back tasks. Run with `npm run db:test` (needs Docker).
-- Anna and Ben share a household; Carol has her own.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carol@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select public.create_household('Carol''s flat');
insert into public.tasks (title, type, points) values ('Carol''s plants', 'physical', 2);

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');
insert into public.tasks (title, type, points) values ('Vacuum', 'physical', 3);
insert into public.tasks (title, type, points, repeat_every_days) values ('Water plants', 'physical', 1, 3);

reset role;
insert into public.household_members (household_id, user_id)
  select household_id, '22222222-2222-2222-2222-222222222222' from public.tasks where title = 'Vacuum';
do $$
begin
  perform set_config('test.vacuum', id::text, true) from public.tasks where title = 'Vacuum';
  perform set_config('test.plants', id::text, true) from public.tasks where title = 'Water plants';
  perform set_config('test.carol', id::text, true) from public.tasks where title = 'Carol''s plants';
end
$$;
set local role authenticated;

-- Anna picks up the vacuuming.
select lives_ok(
  format('select public.pick_up_task(%L)', current_setting('test.vacuum')),
  'a member can pick up an open task in their household'
);
select results_eq(
  format('select picked_up_by, picked_up_at is not null from public.tasks where id = %L', current_setting('test.vacuum')),
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid, true) $$,
  'the task records who picked it up and when'
);
select lives_ok(
  format('select public.pick_up_task(%L)', current_setting('test.vacuum')),
  'picking up a task you already have is fine'
);
select throws_ok(
  format('update public.tasks set picked_up_by = null where id = %L', current_setting('test.vacuum')),
  '42501', null,
  'tasks are picked up and put back only through the functions'
);
select throws_ok(
  format('select public.pick_up_task(%L)', current_setting('test.carol')),
  'P0002', null,
  'a member cannot pick up another household''s task'
);

-- Ben can't take it from her or put it back for her.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok(
  format('select public.pick_up_task(%L)', current_setting('test.vacuum')),
  '55006', null,
  'a task someone else has picked up cannot be picked up'
);
select throws_ok(
  format('select public.put_back_task(%L)', current_setting('test.vacuum')),
  'P0002', null,
  'only whoever picked up a task can put it back'
);

-- Anna puts it back, and Ben takes it.
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok(
  format('select public.put_back_task(%L)', current_setting('test.vacuum')),
  'a member can put back a task they picked up'
);
select results_eq(
  format('select picked_up_by, picked_up_at from public.tasks where id = %L', current_setting('test.vacuum')),
  $$ values (null::uuid, null::timestamptz) $$,
  'a task put back is free again'
);
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok(
  format('select public.pick_up_task(%L)', current_setting('test.vacuum')),
  'a task put back can be picked up by someone else'
);

-- Ben picks up the repeating task and marks it done.
select public.pick_up_task(current_setting('test.plants')::uuid);
select public.complete_task(current_setting('test.plants')::uuid, current_date);
select results_eq(
  format('select picked_up_by from public.tasks where id = %L', current_setting('test.plants')),
  $$ values ('22222222-2222-2222-2222-222222222222'::uuid) $$,
  'a done task keeps who picked it up'
);
select results_eq(
  format('select picked_up_by from public.tasks where previous_task_id = %L', current_setting('test.plants')),
  $$ values (null::uuid) $$,
  'the next occurrence of a repeating task is not picked up'
);
select throws_ok(
  format('select public.pick_up_task(%L)', current_setting('test.plants')),
  'P0002', null,
  'a done task cannot be picked up'
);
select throws_ok(
  format('select public.put_back_task(%L)', current_setting('test.plants')),
  'P0002', null,
  'a done task cannot be put back'
);

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok(
  format('select public.pick_up_task(%L)', current_setting('test.vacuum')),
  '42501', null,
  'visitors cannot pick up tasks'
);

select * from finish();
rollback;
