-- Priority tasks. Run with `npm run db:test` (needs Docker).
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'anna@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');

select lives_ok(
  $$ insert into public.tasks (title, type, points, repeat_every_days, due_on, is_priority)
     values ('Pay the daycare invoice', 'meta', 2, 30, current_date - 3, true) $$,
  'an adults'' shared task can be a priority'
);
select throws_ok(
  $$ insert into public.tasks (title, type, points, is_private, is_priority)
     values ('Call mum', 'meta', null, true, true) $$,
  '23514', null,
  'a private task can''t be a priority'
);
select throws_ok(
  $$ insert into public.tasks (title, type, points, for_children, is_priority)
     values ('Make your bed', 'physical', 1, true, true) $$,
  '23514', null,
  'a task for children can''t be a priority'
);
select throws_ok(
  $$ insert into public.tasks (title, type, points, is_routine, is_priority)
     values ('Empty the dishwasher', 'physical', 1, true, true) $$,
  '23514', null,
  'a routine can''t be a priority'
);

reset role;
do $$
begin
  perform set_config('test.invoice', id::text, true) from public.tasks where title = 'Pay the daycare invoice';
end
$$;
set local role authenticated;

select public.update_task(
  current_setting('test.invoice')::uuid, 'Pay the daycare invoice', null, 'meta', 2::smallint, current_date - 3,
  30::smallint
);
select results_eq(
  format('select is_priority from public.tasks where id = %L', current_setting('test.invoice')),
  $$ values (true) $$,
  'an app that doesn''t send it keeps a task a priority'
);
select public.update_task(
  current_setting('test.invoice')::uuid, 'Pay the daycare invoice', null, 'meta', 2::smallint, current_date - 3,
  30::smallint, task_is_priority => false
);
select results_eq(
  format('select is_priority from public.tasks where id = %L', current_setting('test.invoice')),
  $$ values (false) $$,
  'a task can stop being a priority'
);
select public.update_task(
  current_setting('test.invoice')::uuid, 'Pay the daycare invoice', null, 'meta', 2::smallint, current_date - 3,
  30::smallint, task_is_priority => true
);
select results_eq(
  format('select is_priority from public.tasks where id = %L', current_setting('test.invoice')),
  $$ values (true) $$,
  'a task can be made a priority'
);

select public.complete_task(current_setting('test.invoice')::uuid, current_date);
select results_eq(
  format('select is_priority from public.tasks where previous_task_id = %L', current_setting('test.invoice')),
  $$ values (false) $$,
  'a repeating priority done comes back as an ordinary task'
);

select public.undo_complete_task(current_setting('test.invoice')::uuid);
select results_eq(
  format('select is_priority from public.tasks where id = %L', current_setting('test.invoice')),
  $$ values (true) $$,
  'undoing it brings the priority back'
);

select public.update_task(
  current_setting('test.invoice')::uuid, 'Pay the daycare invoice', null, 'meta', 2::smallint, null, null,
  task_is_routine => true, task_is_priority => true
);
select results_eq(
  format('select is_routine, is_priority from public.tasks where id = %L', current_setting('test.invoice')),
  $$ values (true, false) $$,
  'a task made a routine stops being a priority'
);

select * from finish();
rollback;
