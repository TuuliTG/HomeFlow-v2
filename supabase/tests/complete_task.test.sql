-- Marking tasks done, and repeating tasks. Run with `npm run db:test` (needs Docker).
-- Anna and Ben share a household; Carol has her own.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

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
select lives_ok(
  $$ insert into public.tasks (title, type, points, repeat_every_days, due_on)
     values ('Change bed linen', 'physical', 4, 14, current_date - 3) $$,
  'a member can add a repeating task with a due date'
);
insert into public.tasks (title, type, points) values ('Fix the shelf', 'physical', 3);
select throws_ok(
  $$ insert into public.tasks (title, type, points, repeat_every_days) values ('Dust', 'physical', 1, 0) $$,
  '23514', null,
  'a task must repeat at least every day'
);
select throws_ok(
  $$ insert into public.tasks (title, type, points, completed_at) values ('Dust', 'physical', 1, now()) $$,
  '42501', null,
  'a new task cannot be added as already done'
);

reset role;
do $$
begin
  perform set_config('test.linen', id::text, true) from public.tasks where title = 'Change bed linen';
  perform set_config('test.shelf', id::text, true) from public.tasks where title = 'Fix the shelf';
  perform set_config('test.carol', id::text, true) from public.tasks where title = 'Carol''s plants';
end
$$;
set local role authenticated;

-- Ben joins Anna's household and marks her overdue repeating task done.
reset role;
insert into public.household_members (household_id, user_id)
  select household_id, '22222222-2222-2222-2222-222222222222' from public.tasks where title = 'Fix the shelf';
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select throws_ok(
  format('select public.complete_task(%L, current_date - 2)', current_setting('test.linen')),
  '22023', null,
  'a task cannot be marked done on another day'
);
select throws_ok(
  format('update public.tasks set completed_at = now() where id = %L', current_setting('test.linen')),
  '42501', null,
  'tasks can be marked done only through complete_task()'
);
select isnt(
  public.complete_task(current_setting('test.linen')::uuid, current_date),
  null,
  'marking a repeating task done returns its next occurrence'
);
select results_eq(
  format('select completed_by from public.tasks where id = %L', current_setting('test.linen')),
  $$ values ('22222222-2222-2222-2222-222222222222'::uuid) $$,
  'the task records who did it'
);
select ok(
  (select completed_at is not null from public.tasks where id = current_setting('test.linen')::uuid),
  'the task records when it was done'
);
select results_eq(
  format(
    'select title, type, points, repeat_every_days, due_on, created_by from public.tasks where previous_task_id = %L',
    current_setting('test.linen')
  ),
  $$ values ('Change bed linen', 'physical', 4::smallint, 14::smallint, current_date + 14,
             '11111111-1111-1111-1111-111111111111'::uuid) $$,
  'the next occurrence is due 14 days after the day it was done, and keeps who planned it'
);
select ok(
  (select completed_at is null from public.tasks where previous_task_id = current_setting('test.linen')::uuid),
  'the next occurrence is open'
);
select throws_ok(
  format('select public.complete_task(%L, current_date)', current_setting('test.linen')),
  'P0002', null,
  'a task cannot be marked done twice'
);
select is(
  (select count(*)::int from public.tasks where title = 'Change bed linen'),
  2,
  'marking done twice does not add another occurrence'
);

select is(
  public.complete_task(current_setting('test.shelf')::uuid, current_date + 1),
  null,
  'a one-off task has no next occurrence (the user''s date may be a day ahead of the server''s)'
);
select is(
  (select count(*)::int from public.tasks where title = 'Fix the shelf'),
  1,
  'a one-off task is not repeated'
);
select throws_ok(
  format('select public.complete_task(%L, current_date)', current_setting('test.carol')),
  'P0002', null,
  'a member cannot mark another household''s task done'
);

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok(
  format('select public.complete_task(%L, current_date)', current_setting('test.shelf')),
  '42501', null,
  'visitors cannot mark tasks done'
);

select * from finish();
rollback;
