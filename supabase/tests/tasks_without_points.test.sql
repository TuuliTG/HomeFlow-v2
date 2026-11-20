-- Shared tasks without points (0), which count for nobody. Run with `npm run db:test` (needs Docker).
-- Anna (an adult) and Ben (a child who may add tasks) share a household.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');
select lives_ok(
  $$ insert into public.tasks (title, type, points) values ('Dentist on Thursday', 'meta', 0) $$,
  'an adult can add a shared task without points'
);
insert into public.tasks (title, type, points) values ('Laundry', 'physical', 3);
select throws_ok(
  $$ insert into public.tasks (title, type, points) values ('Too much', 'physical', 11) $$,
  '23514', null,
  'a task still has at most 10 points'
);

reset role;
insert into public.household_members (household_id, user_id, is_child, can_add_tasks)
  select household_id, '22222222-2222-2222-2222-222222222222', true, true from public.tasks where title = 'Laundry';
insert into public.tasks (household_id, title, type, points, for_children, created_by)
  select household_id, 'Tidy up', 'physical', null, true, '22222222-2222-2222-2222-222222222222'
  from public.tasks where title = 'Laundry';
do $$
begin
  perform set_config('test.dentist', id::text, true) from public.tasks where title = 'Dentist on Thursday';
  perform set_config('test.laundry', id::text, true) from public.tasks where title = 'Laundry';
  perform set_config('test.tidy', id::text, true) from public.tasks where title = 'Tidy up';
end
$$;
set local role authenticated;

select public.complete_task(current_setting('test.dentist')::uuid, current_date);
select public.complete_task(current_setting('test.laundry')::uuid, current_date);

select results_eq(
  $$ select done, points, created from public.household_statistics(null)
     where user_id = '11111111-1111-1111-1111-111111111111' $$,
  $$ values (1, 3, 1) $$,
  'a task with 0 points counts neither as a task done nor as a task created'
);
select is(public.own_total_points(), 3, 'a task with 0 points adds nothing to the total');
select throws_ok(
  format($$ select public.set_task_helpers(%L, '[]') $$, current_setting('test.dentist')),
  'P0002', null,
  'nobody is credited for helping with a task with 0 points'
);
select lives_ok(
  format('select public.award_task_points(%L, 0::smallint)', current_setting('test.tidy')),
  'an adult can decide a child''s task earns no points'
);

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok(
  $$ insert into public.tasks (title, type, points, for_children) values ('Pack my bag', 'physical', 0, true) $$,
  '42501', null,
  'a child does not choose points, not even none'
);
select results_eq(
  $$ select created from public.household_statistics(null)
     where user_id = '22222222-2222-2222-2222-222222222222' $$,
  $$ values (0) $$,
  'a child''s task awarded no points counts for nobody'
);

select * from finish();
rollback;
