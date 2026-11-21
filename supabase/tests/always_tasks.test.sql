-- Always tasks: a child's chore that is always there, with a short pause after it is done and an optional daily
-- limit. Run with `npm run db:test` (needs Docker). Anna (adult) and Ben (child) share a household.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');

reset role;
insert into public.household_members (household_id, user_id, is_child, can_add_tasks)
  select household_id, '22222222-2222-2222-2222-222222222222', true, true
    from public.household_members where user_id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;

select lives_ok(
  $$ insert into public.tasks (title, type, points, for_children, assigned_to, is_always, daily_limit)
     values ('Make your bed', 'physical', 1, true, '22222222-2222-2222-2222-222222222222', true, 1) $$,
  'an adult can give a child an always task with a daily limit'
);
select lives_ok(
  $$ insert into public.tasks (title, type, points, for_children, assigned_to, is_always)
     values ('Brush teeth', 'physical', 1, true, '22222222-2222-2222-2222-222222222222', true) $$,
  'an always task can have no limit'
);
select throws_ok(
  $$ insert into public.tasks (title, type, points, for_children, is_always, repeat_every_days)
     values ('Feed the cat', 'physical', 1, true, true, 1) $$,
  '23514', null,
  'an always task does not repeat'
);
select throws_ok(
  $$ insert into public.tasks (title, type, points, is_always) values ('Cook', 'physical', 1, true) $$,
  '23514', null,
  'an always task is for children'
);
select throws_ok(
  $$ insert into public.tasks (title, type, points, for_children, is_always, daily_limit)
     values ('Feed the cat', 'physical', 1, true, true, 0) $$,
  '23514', null,
  'a daily limit is at least once'
);

reset role;
do $$
begin
  perform set_config('test.bed', id::text, true) from public.tasks where title = 'Make your bed';
  perform set_config('test.teeth', id::text, true) from public.tasks where title = 'Brush teeth';
end
$$;
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select throws_ok(
  $$ insert into public.tasks (title, type, for_children, is_always) values ('Read', 'physical', true, true) $$,
  '42501', null,
  'a child cannot add an always task'
);

-- Ben brushes his teeth: a fresh copy is his at once, counting once today.
select set_config('test.teeth2', public.complete_task(current_setting('test.teeth')::uuid, current_date)::text, true);
select results_eq(
  $$ select picked_up_by, is_always, times_done, times_done_on from public.tasks
     where id = current_setting('test.teeth2')::uuid $$,
  $$ values ('22222222-2222-2222-2222-222222222222'::uuid, true, 1::smallint, current_date) $$,
  'marking an always task done adds a fresh copy for the child, counting the times done today'
);
select throws_ok(
  $$ select public.complete_task(current_setting('test.teeth2')::uuid, current_date) $$,
  '55006', null,
  'an always task cannot be done again within the pause'
);

-- After the pause it can be done again, as often as there is no limit.
reset role;
update public.tasks set completed_at = now() - interval '3 minutes' where id = current_setting('test.teeth')::uuid;
set local role authenticated;
select set_config(
  'test.teeth3', public.complete_task(current_setting('test.teeth2')::uuid, current_date)::text, true
);
select is(
  (select times_done from public.tasks where id = current_setting('test.teeth3')::uuid),
  2::smallint,
  'after the pause a task without a limit can be done again'
);

-- Making the bed once uses up today's limit; tomorrow it starts again.
select set_config('test.bed2', public.complete_task(current_setting('test.bed')::uuid, current_date)::text, true);
reset role;
update public.tasks set completed_at = now() - interval '3 minutes' where id = current_setting('test.bed')::uuid;
set local role authenticated;
select throws_ok(
  $$ select public.complete_task(current_setting('test.bed2')::uuid, current_date) $$,
  '55006', null,
  'an always task cannot be done more often than its daily limit'
);
select set_config(
  'test.bed3', public.complete_task(current_setting('test.bed2')::uuid, current_date + 1)::text, true
);
select is(
  (select times_done from public.tasks where id = current_setting('test.bed3')::uuid),
  1::smallint,
  'the daily limit starts again the next day'
);

-- Anna turns the limit off.
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.update_task(
  current_setting('test.bed3')::uuid, 'Make your bed', null, 'physical', 1::smallint, null, null, true, null, null,
  false, null, null, null, true, null
);
select results_eq(
  $$ select is_always, daily_limit from public.tasks where id = current_setting('test.bed3')::uuid $$,
  $$ values (true, null::smallint) $$,
  'an adult can turn an always task''s limit off'
);

select * from finish();
rollback;
