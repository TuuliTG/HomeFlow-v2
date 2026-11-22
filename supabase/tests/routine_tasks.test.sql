-- Routine tasks. Run with `npm run db:test` (needs Docker).
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'anna@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');

select lives_ok(
  $$ insert into public.tasks (title, type, points, is_routine)
     values ('Empty the dishwasher', 'physical', 1, true) $$,
  'a task without a repeat or a due date can be a routine'
);
select throws_ok(
  $$ insert into public.tasks (title, type, points, repeat_every_days, is_routine)
     values ('Water plants', 'physical', 1, 3, true) $$,
  '23514', null,
  'a repeating task can''t be a routine'
);
select throws_ok(
  $$ insert into public.tasks (title, type, points, due_on, is_routine)
     values ('Water plants', 'physical', 1, current_date, true) $$,
  '23514', null,
  'a task with a due date can''t be a routine'
);

reset role;
do $$
begin
  perform set_config('test.dishes', id::text, true) from public.tasks where title = 'Empty the dishwasher';
end
$$;
set local role authenticated;

select public.complete_task(current_setting('test.dishes')::uuid, current_date);
select results_eq(
  format(
    'select is_routine, repeat_every_days, due_on, completed_at is null from public.tasks where previous_task_id = %L',
    current_setting('test.dishes')
  ),
  $$ values (true, null::smallint, null::date, true) $$,
  'a routine done is there again at once, a routine too'
);
select results_eq(
  $$ select is_routine from public.task_suggestions() where title = 'Empty the dishwasher' $$,
  $$ values (true) $$,
  'adding a task again keeps it a routine'
);

reset role;
do $$
begin
  perform set_config('test.next', id::text, true) from public.tasks
    where previous_task_id = current_setting('test.dishes')::uuid;
end
$$;
set local role authenticated;

select lives_ok(
  format('select public.complete_task(%L, current_date)', current_setting('test.next')),
  'a routine can be done again straight away'
);

reset role;
do $$
begin
  perform set_config('test.next', id::text, true) from public.tasks
    where previous_task_id = current_setting('test.next')::uuid;
end
$$;
set local role authenticated;

select public.update_task(
  current_setting('test.next')::uuid, 'Empty the dishwasher', null, 'physical', 1::smallint, null, null
);
select results_eq(
  format('select is_routine from public.tasks where id = %L', current_setting('test.next')),
  $$ values (true) $$,
  'an app that doesn''t send it keeps a task a routine'
);
select public.update_task(
  current_setting('test.next')::uuid, 'Empty the dishwasher', null, 'physical', 1::smallint, null, 1::smallint,
  task_is_routine => true
);
select results_eq(
  format('select is_routine from public.tasks where id = %L', current_setting('test.next')),
  $$ values (false) $$,
  'a task given a repeat stops being a routine'
);
select public.update_task(
  current_setting('test.next')::uuid, 'Empty the dishwasher', null, 'physical', 1::smallint, null, null,
  task_is_routine => true
);
select results_eq(
  format('select is_routine from public.tasks where id = %L', current_setting('test.next')),
  $$ values (true) $$,
  'a task can be made a routine'
);

select results_eq(
  $$ select created from public.household_statistics(null) $$,
  $$ values (1) $$,
  'the fresh copies of a routine don''t count as added'
);

select * from finish();
rollback;
