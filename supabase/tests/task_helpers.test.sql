-- Helping with a task: whoever marked a shared task done gives helpers bonus points, keeping all of its own. Run with
-- `npm run db:test` (needs Docker). Anna and Dan (adults) and Ben (a child) share a household; Carol has her own.
-- Anna does the laundry, an adults-only task, and Ben helps.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carol@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'dan@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select public.create_household('Carol''s flat');
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');
insert into public.tasks (title, type, points) values
  ('Laundry', 'physical', 5), ('Old chore', 'physical', 4), ('Dishes', 'physical', 2);
insert into public.tasks (title, type, points, is_private) values ('Buy a present', 'meta', null, true);

reset role;
insert into public.household_members (household_id, user_id, is_child)
  select household_id, '22222222-2222-2222-2222-222222222222', true from public.tasks where title = 'Laundry';
insert into public.household_members (household_id, user_id)
  select household_id, '44444444-4444-4444-4444-444444444444' from public.tasks where title = 'Laundry';
update public.tasks
  set completed_by = '11111111-1111-1111-1111-111111111111', completed_at = now() - interval '8 days'
  where title = 'Old chore';
update public.tasks set completed_by = '11111111-1111-1111-1111-111111111111', completed_at = now()
  where title = 'Buy a present';
do $$
begin
  perform set_config('test.laundry', id::text, true) from public.tasks where title = 'Laundry';
  perform set_config('test.old', id::text, true) from public.tasks where title = 'Old chore';
  perform set_config('test.dishes', id::text, true) from public.tasks where title = 'Dishes';
  perform set_config('test.present', id::text, true) from public.tasks where title = 'Buy a present';
end
$$;
set local role authenticated;

select public.add_shared_goal('Ice cream', 2, '[{"user_id": "22222222-2222-2222-2222-222222222222"}]');
select public.complete_task(current_setting('test.laundry')::uuid, current_date);

-- Only whoever marked the task done chooses helpers, from the household, for a recent shared task with points.
select throws_ok(
  format($$ select public.set_task_helpers(%L, '[]') $$, current_setting('test.dishes')),
  'P0002', null,
  'an open task has no helpers'
);
select throws_ok(
  format($$ select public.set_task_helpers(%L, '[]') $$, current_setting('test.old')),
  'P0002', null,
  'helpers are chosen within a week of doing the task'
);
select throws_ok(
  format($$ select public.set_task_helpers(%L, '[]') $$, current_setting('test.present')),
  'P0002', null,
  'a private task has no helpers'
);
select throws_ok(
  format(
    $$ select public.set_task_helpers(%L, '[{"user_id": "11111111-1111-1111-1111-111111111111", "points": 1}]') $$,
    current_setting('test.laundry')
  ),
  '42501', null,
  'the doer does not help themselves'
);
select throws_ok(
  format(
    $$ select public.set_task_helpers(%L, '[{"user_id": "33333333-3333-3333-3333-333333333333", "points": 1}]') $$,
    current_setting('test.laundry')
  ),
  '42501', null,
  'helpers are in the household'
);
select throws_ok(
  format(
    $$ select public.set_task_helpers(%L, '[{"user_id": "22222222-2222-2222-2222-222222222222", "points": 1},
       {"user_id": "22222222-2222-2222-2222-222222222222", "points": 1}]') $$,
    current_setting('test.laundry')
  ),
  '23514', null,
  'a helper is listed once'
);
select throws_ok(
  format(
    $$ select public.set_task_helpers(%L, '[{"user_id": "22222222-2222-2222-2222-222222222222", "points": 11}]') $$,
    current_setting('test.laundry')
  ),
  '23514', null,
  'a helper''s bonus is at most 10 points'
);
select throws_ok(
  format(
    $$ select public.set_task_helpers(%L, '[{"user_id": "22222222-2222-2222-2222-222222222222", "points": 0}]') $$,
    current_setting('test.laundry')
  ),
  '23514', null,
  'a helper gets at least a point'
);
select lives_ok(
  format(
    $$ select public.set_task_helpers(%L, '[{"user_id": "22222222-2222-2222-2222-222222222222", "points": 2}]') $$,
    current_setting('test.laundry')
  ),
  'the doer can give a helper bonus points'
);
select throws_ok(
  $$ insert into public.task_helpers (task_id, user_id, points)
     values (current_setting('test.laundry')::uuid, '44444444-4444-4444-4444-444444444444', 1) $$,
  '42501', null,
  'helpers are set only through set_task_helpers()'
);

-- Anna keeps the task's points and Ben's bonus counts for him everywhere points count.
select results_eq(
  $$ select user_id::text, done, points from public.household_statistics(now() - interval '1 day') order by user_id $$,
  $$ values ('11111111-1111-1111-1111-111111111111', 1, 5), ('22222222-2222-2222-2222-222222222222', 1, 2),
       ('44444444-4444-4444-4444-444444444444', 0, 0) $$,
  'statistics credit the doer the task''s points and the helper their bonus'
);
select is(public.own_total_points(), 4 + 5, 'the doer keeps all the task''s points');
select results_eq(
  $$ select points, reached from public.household_goals() $$,
  $$ values (2, true) $$,
  'a helper''s bonus counts towards their goals'
);

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is(public.own_total_points(), 2, 'a child gets their bonus for an adults-only task they helped with');
select is_empty(
  $$ select 1 from public.task_helpers $$,
  'a child does not see helpers of a task they cannot see'
);
select throws_ok(
  format($$ select public.set_task_helpers(%L, '[]') $$, current_setting('test.laundry')),
  '42501', null,
  'children don''t say who helped'
);

set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select throws_ok(
  format($$ select public.set_task_helpers(%L, '[]') $$, current_setting('test.laundry')),
  'P0002', null,
  'only whoever marked the task done chooses its helpers'
);

-- Anna gives Dan a bonus as well, replacing the helpers, then undoes it.
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok(
  format(
    $$ select public.set_task_helpers(%L, '[{"user_id": "22222222-2222-2222-2222-222222222222", "points": 2},
       {"user_id": "44444444-4444-4444-4444-444444444444", "points": 6}]') $$,
    current_setting('test.laundry')
  ),
  'bonuses can add up to more than the task''s points'
);
select is(public.own_total_points(), 4 + 5, 'bonuses never cost the doer points');
select lives_ok(
  format('select public.undo_complete_task(%L)', current_setting('test.laundry')),
  'the doer can undo a task with helpers'
);
select is_empty(
  $$ select 1 from public.task_helpers $$,
  'undoing a task removes its helpers'
);

select * from finish();
rollback;
