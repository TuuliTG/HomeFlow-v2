-- Goals and rewards. Run with `npm run db:test` (needs Docker).
-- Anna and Ben share a household and Carl has his own. Anna sets a family goal and a personal one; tasks done
-- before the goals were set don't count. (now() is the same all through the transaction.)
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carl@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select public.create_household('The Joneses');
insert into public.goals (title, target_points) values ('Cinema trip', 5);

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');
insert into public.tasks (title, type, points) values
  ('Vacuum', 'physical', 3), ('Book dentist', 'meta', 2), ('Mow the lawn', 'physical', 4),
  ('Old chore', 'physical', 9);
insert into public.tasks (title, type, points, is_private) values ('Buy a present', 'meta', null, true);
insert into public.goals (title, target_points) values ('Pizza night', 5);
insert into public.goals (title, target_points, owner_id)
  values ('New book', 3, '11111111-1111-1111-1111-111111111111');

reset role;
insert into public.household_members (household_id, user_id)
  select household_id, '22222222-2222-2222-2222-222222222222' from public.tasks where title = 'Vacuum';
-- Anna did the meta work and her private task, Ben vacuumed; the old chore was done before the goals were set.
update public.tasks set completed_by = '11111111-1111-1111-1111-111111111111', completed_at = now()
  where title in ('Book dentist', 'Buy a present');
update public.tasks set completed_by = '22222222-2222-2222-2222-222222222222', completed_at = now()
  where title = 'Vacuum';
update public.tasks
  set completed_by = '11111111-1111-1111-1111-111111111111', completed_at = now() - interval '1 day'
  where title = 'Old chore';
do $$
begin
  perform set_config('test.pizza', id::text, true) from public.goals where title = 'Pizza night';
  perform set_config('test.book', id::text, true) from public.goals where title = 'New book';
  perform set_config('test.cinema', id::text, true) from public.goals where title = 'Cinema trip';
end
$$;
set local role authenticated;

select results_eq(
  $$ select title, target_points, owner_id::text, points from public.household_goals() order by title $$,
  $$ values ('New book', 3, '11111111-1111-1111-1111-111111111111', 2), ('Pizza night', 5, null, 5) $$,
  'a family goal counts everyone''s shared points since it was set, a personal goal only its owner''s'
);
select throws_ok(
  format('select public.claim_goal_reward(%L)', current_setting('test.book')),
  '23514', null,
  'a goal cannot be claimed before it is reached'
);

-- Ben sees the family goal but not Anna's personal one, and can't set a personal goal for her.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select results_eq(
  $$ select title from public.household_goals() $$,
  $$ values ('Pizza night') $$,
  'other members see family goals but not someone''s personal goals'
);
select throws_ok(
  $$ insert into public.goals (title, target_points, owner_id)
     values ('Sweets', 2, '11111111-1111-1111-1111-111111111111') $$,
  '42501', null,
  'nobody sets a personal goal for someone else'
);
select throws_ok(
  format('select public.claim_goal_reward(%L)', current_setting('test.book')),
  'P0002', null,
  'other members cannot claim someone''s personal goal'
);
delete from public.goals where id = current_setting('test.book')::uuid;
select is(
  (select count(*)::integer from public.goals where id = current_setting('test.book')::uuid),
  0, 'other members cannot see someone''s personal goal to delete it'
);
select throws_ok(
  $$ insert into public.goals (title, target_points) values ('Holiday', 0) $$,
  '23514', null,
  'a goal needs at least one point'
);
select throws_ok(
  $$ insert into public.goals (title, target_points, household_id)
     values ('Theirs', 2, (select id from public.households limit 1)) $$,
  '42501', null,
  'the household always comes from the default'
);
select lives_ok(
  format('select public.claim_goal_reward(%L)', current_setting('test.pizza')),
  'any member can claim a reached family goal'
);
select results_eq(
  $$ select claimed_by::text, claimed_at is not null from public.goals where title = 'Pizza night' $$,
  $$ values ('22222222-2222-2222-2222-222222222222', true) $$,
  'claiming records who claimed it and when'
);
select throws_ok(
  format('select public.claim_goal_reward(%L)', current_setting('test.pizza')),
  'P0002', null,
  'a reward is claimed only once'
);
delete from public.goals where id = current_setting('test.pizza')::uuid;
select is(
  (select count(*)::integer from public.goals where id = current_setting('test.pizza')::uuid),
  1, 'claimed goals stay as history'
);
insert into public.goals (title, target_points, owner_id)
  values ('Sweets', 2, '22222222-2222-2222-2222-222222222222');
delete from public.goals where title = 'Sweets';
select is(
  (select count(*)::integer from public.goals where title = 'Sweets'),
  0, 'members can delete an open goal'
);

-- Anna mows the lawn after the family goal was claimed.
reset role;
update public.tasks
  set completed_by = '11111111-1111-1111-1111-111111111111', completed_at = now() + interval '1 minute'
  where title = 'Mow the lawn';
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select results_eq(
  $$ select title, points from public.household_goals() $$,
  $$ values ('New book', 6), ('Pizza night', 5) $$,
  'open goals come first, and a claimed goal keeps the points it had when claimed'
);
select lives_ok(
  format('select public.claim_goal_reward(%L)', current_setting('test.book')),
  'members can claim their own reached personal goal'
);

-- Carl's household is separate.
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select results_eq(
  $$ select title, points from public.household_goals() $$,
  $$ values ('Cinema trip', 0) $$,
  'other households'' goals and points are left out'
);
select throws_ok(
  format('select public.claim_goal_reward(%L)', current_setting('test.pizza')),
  'P0002', null,
  'members cannot claim another household''s goal'
);

reset role;
set local role anon;
select throws_ok(
  $$ select * from public.household_goals() $$,
  '42501', null,
  'logged-out visitors cannot read goals'
);

select * from finish();
rollback;
