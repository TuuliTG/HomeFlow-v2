-- Editing, deleting and undoing "Mark done". Run with `npm run db:test` (needs Docker).
-- Anna and Ben share a household; Carol has her own.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

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
insert into public.tasks (title, type, points) values ('Vacum', 'physical', 3);
insert into public.tasks (title, type, points) values ('Dust', 'physical', 1);
insert into public.tasks (title, type, points, repeat_every_days) values ('Water plants', 'physical', 1, 3);

reset role;
insert into public.household_members (household_id, user_id)
  select household_id, '22222222-2222-2222-2222-222222222222' from public.tasks where title = 'Dust';
do $$
begin
  perform set_config('test.vacuum', id::text, true) from public.tasks where title = 'Vacum';
  perform set_config('test.dust', id::text, true) from public.tasks where title = 'Dust';
  perform set_config('test.plants', id::text, true) from public.tasks where title = 'Water plants';
  perform set_config('test.carol', id::text, true) from public.tasks where title = 'Carol''s plants';
end
$$;
set local role authenticated;

-- Ben fixes Anna's typo and changes the details.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok(
  format(
    $$ select public.update_task(%L, 'Vacuum', 'planning', 5::smallint, '2026-12-24', 7::smallint) $$,
    current_setting('test.vacuum')
  ),
  'any member can edit an open task in their household'
);
select results_eq(
  format(
    'select title, type, points, due_on, repeat_every_days, created_by from public.tasks where id = %L',
    current_setting('test.vacuum')
  ),
  $$ values ('Vacuum', 'planning', 5::smallint, '2026-12-24'::date, 7::smallint,
             '11111111-1111-1111-1111-111111111111'::uuid) $$,
  'editing changes the details but not who added the task'
);
select lives_ok(
  format(
    $$ select public.update_task(%L, 'Vacuum', 'physical', 3::smallint, null, null) $$,
    current_setting('test.vacuum')
  ),
  'a due date and repeating can be removed'
);
select throws_ok(
  format($$ select public.update_task(%L, '', 'physical', 3::smallint, null, null) $$, current_setting('test.vacuum')),
  '23514', null,
  'an edit must still be a valid task'
);
select throws_ok(
  format($$ select public.update_task(%L, 'Hacked', 'physical', 3::smallint, null, null) $$, current_setting('test.carol')),
  'P0002', null,
  'a member cannot edit another household''s task'
);
select throws_ok(
  format('update public.tasks set title = %L where id = %L', 'Direct', current_setting('test.vacuum')),
  '42501', null,
  'tasks are edited only through update_task()'
);

-- Deleting.
select lives_ok(
  format('select public.delete_task(%L)', current_setting('test.dust')),
  'any member can delete an open task in their household'
);
select is_empty(
  format('select 1 from public.tasks where id = %L', current_setting('test.dust')),
  'the deleted task is gone'
);
select throws_ok(
  format('select public.delete_task(%L)', current_setting('test.carol')),
  'P0002', null,
  'a member cannot delete another household''s task'
);
select throws_ok(
  format('delete from public.tasks where id = %L', current_setting('test.vacuum')),
  '42501', null,
  'tasks are deleted only through delete_task()'
);

-- Ben marks the repeating task done, then undoes it.
select public.complete_task(current_setting('test.plants')::uuid, current_date);
select throws_ok(
  format($$ select public.update_task(%L, 'Edited', 'physical', 1::smallint, null, 3::smallint) $$, current_setting('test.plants')),
  'P0002', null,
  'a done task cannot be edited'
);
select throws_ok(
  format('select public.delete_task(%L)', current_setting('test.plants')),
  'P0002', null,
  'a done task cannot be deleted'
);

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select throws_ok(
  format('select public.undo_complete_task(%L)', current_setting('test.plants')),
  'P0002', null,
  'only whoever marked a task done can undo it'
);

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok(
  format('select public.undo_complete_task(%L)', current_setting('test.plants')),
  'a member can undo marking a task done'
);
select results_eq(
  format('select completed_at, completed_by from public.tasks where id = %L', current_setting('test.plants')),
  $$ values (null::timestamptz, null::uuid) $$,
  'the task is open again'
);
select is(
  (select count(*)::int from public.tasks where title = 'Water plants'),
  1,
  'the next occurrence it created is removed'
);

-- Undo isn't possible once the next occurrence is done, or after an hour.
select public.complete_task(current_setting('test.plants')::uuid, current_date);
reset role;
update public.tasks set completed_at = now(), completed_by = '22222222-2222-2222-2222-222222222222'
  where previous_task_id = current_setting('test.plants')::uuid;
set local role authenticated;
select throws_ok(
  format('select public.undo_complete_task(%L)', current_setting('test.plants')),
  '55006', null,
  'a task cannot be undone once its next occurrence is done'
);
reset role;
update public.tasks set completed_at = now() - interval '2 hours' where id = current_setting('test.vacuum')::uuid;
update public.tasks set completed_by = '22222222-2222-2222-2222-222222222222' where id = current_setting('test.vacuum')::uuid;
set local role authenticated;
select throws_ok(
  format('select public.undo_complete_task(%L)', current_setting('test.vacuum')),
  'P0002', null,
  'a task cannot be undone after an hour'
);
select throws_ok(
  format('select public.undo_complete_task(%L)', current_setting('test.carol')),
  'P0002', null,
  'a member cannot undo another household''s task'
);

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok(
  format('select public.delete_task(%L)', current_setting('test.vacuum')),
  '42501', null,
  'visitors cannot delete tasks'
);
select throws_ok(
  format('select public.undo_complete_task(%L)', current_setting('test.vacuum')),
  '42501', null,
  'visitors cannot undo tasks'
);

select * from finish();
rollback;
