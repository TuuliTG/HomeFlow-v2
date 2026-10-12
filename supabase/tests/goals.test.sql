-- Goals and rewards. Run with `npm run db:test` (needs Docker).
-- Anna and Ben share a household and Carl has his own. Anna sets a family goal and a personal one; tasks done
-- before the goals were set don't count. (now() is the same all through the transaction.)
begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carl@example.com');
insert into public.profiles (id, display_name) values ('11111111-1111-1111-1111-111111111111', 'Anna');

set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select public.create_household('The Joneses');
select public.add_shared_goal('Cinema trip', 5, '[{"user_id": "33333333-3333-3333-3333-333333333333"}]');

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');
insert into public.tasks (title, type, points) values
  ('Vacuum', 'physical', 3), ('Book dentist', 'meta', 2), ('Mow the lawn', 'physical', 4),
  ('Old chore', 'physical', 9);
insert into public.tasks (title, type, points, is_private) values ('Buy a present', 'meta', null, true);
insert into public.goals (title, target_points, owner_id)
  values ('New book', 3, '11111111-1111-1111-1111-111111111111');

reset role;
insert into public.household_members (household_id, user_id)
  select household_id, '22222222-2222-2222-2222-222222222222' from public.tasks where title = 'Vacuum';
set local role authenticated;
select public.add_shared_goal('Pizza night', 5, '[{"user_id": "11111111-1111-1111-1111-111111111111"},
  {"user_id": "22222222-2222-2222-2222-222222222222"}]');
reset role;
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

-- Ben sees Anna's personal goal too, but can't set, claim or delete one for her.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select results_eq(
  $$ select title, owner_name, points from public.household_goals() order by title $$,
  $$ values ('New book', 'Anna', 2), ('Pizza night', null, 5) $$,
  'other members see someone''s personal goal, its progress and whose it is'
);
select throws_ok(
  $$ insert into public.goals (title, target_points, owner_id)
     values ('Sweets', 2, '33333333-3333-3333-3333-333333333333') $$,
  '42501', null,
  'nobody sets a personal goal for someone outside their household'
);
select lives_ok(
  $$ insert into public.goals (title, target_points, owner_id)
     values ('Sweets', 2, '11111111-1111-1111-1111-111111111111') $$,
  'an adult can set a personal goal for another member'
);
select throws_ok(
  format('select public.claim_goal_reward(%L)', current_setting('test.book')),
  'P0002', null,
  'other members cannot claim someone''s personal goal'
);
delete from public.goals where title = 'Sweets';
select is(
  (select count(*)::integer from public.goals where title = 'Sweets'),
  0, 'an adult can delete any open goal, also someone''s personal one'
);
select throws_ok(
  $$ select public.add_shared_goal('Holiday', 0, '[{"user_id": "11111111-1111-1111-1111-111111111111"}]') $$,
  '23514', null,
  'a goal needs at least one point'
);
select throws_ok(
  $$ insert into public.goals (title, target_points) values ('Holiday', 5) $$,
  '42501', null,
  'shared goals are added only with their participants'
);
select throws_ok(
  $$ insert into public.goals (title, target_points, owner_id, household_id)
     values ('Theirs', 2, '22222222-2222-2222-2222-222222222222', (select id from public.households limit 1)) $$,
  '42501', null,
  'the household always comes from the default'
);
select lives_ok(
  format('select public.claim_goal_reward(%L)', current_setting('test.pizza')),
  'a participant can claim a reached shared goal'
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

-- Shared goals for chosen members, each with their own minimum. Anna has 6 points since the goals were set and
-- Ben 3.
select public.add_shared_goal('Movie night', 8, '[{"user_id": "11111111-1111-1111-1111-111111111111", "min_points": 3},
  {"user_id": "22222222-2222-2222-2222-222222222222", "min_points": 2}]');
select public.add_shared_goal('Zoo trip', 8, '[{"user_id": "11111111-1111-1111-1111-111111111111", "min_points": 2},
  {"user_id": "22222222-2222-2222-2222-222222222222", "min_points": 4}]');
select public.add_shared_goal('Bike', 3, '[{"user_id": "22222222-2222-2222-2222-222222222222"}]');
select results_eq(
  $$ select title, points, reached, participants from public.household_goals()
     where title in ('Movie night', 'Zoo trip', 'Bike') order by title $$,
  $$ values
    ('Bike', 3, true, '[{"user_id": "22222222-2222-2222-2222-222222222222", "display_name": null, "points": 3, "min_points": null}]'::jsonb),
    ('Movie night', 9, true, '[{"user_id": "11111111-1111-1111-1111-111111111111", "display_name": "Anna", "points": 6, "min_points": 3},
                              {"user_id": "22222222-2222-2222-2222-222222222222", "display_name": null, "points": 3, "min_points": 2}]'::jsonb),
    ('Zoo trip', 9, false, '[{"user_id": "11111111-1111-1111-1111-111111111111", "display_name": "Anna", "points": 6, "min_points": 2},
                             {"user_id": "22222222-2222-2222-2222-222222222222", "display_name": null, "points": 3, "min_points": 4}]'::jsonb) $$,
  'only participants'' points count, and a goal is reached once each has earned their own minimum'
);
select throws_ok(
  $$ select public.claim_goal_reward(id) from public.goals where title = 'Zoo trip' $$,
  '23514', null,
  'a goal cannot be claimed while a participant has earned less than their minimum'
);
select lives_ok(
  $$ select public.claim_goal_reward(id) from public.goals where title = 'Movie night' $$,
  'a goal is claimed once every participant has earned their minimum'
);
select throws_ok(
  $$ select public.claim_goal_reward(id) from public.goals where title = 'Bike' $$,
  'P0002', null,
  'members who don''t take part in a shared goal cannot claim it'
);
select is(
  (select participants from public.household_goals() where title = 'New book'),
  null, 'personal goals list no participants'
);
select throws_ok(
  $$ select public.add_shared_goal('Holiday', 5, '[]') $$,
  '23514', null,
  'a shared goal needs someone to take part'
);
select throws_ok(
  $$ select public.add_shared_goal('Holiday', 5, '[{"user_id": "11111111-1111-1111-1111-111111111111", "min_points": 3},
       {"user_id": "22222222-2222-2222-2222-222222222222", "min_points": 3}]') $$,
  '23514', null,
  'the minimums together are at most the goal''s points'
);
select throws_ok(
  $$ select public.add_shared_goal('Holiday', 5, '[{"user_id": "11111111-1111-1111-1111-111111111111", "min_points": 0}]') $$,
  '23514', null,
  'a minimum is at least one point'
);
select throws_ok(
  $$ select public.add_shared_goal('Holiday', 5, '[{"user_id": "33333333-3333-3333-3333-333333333333"}]') $$,
  '42501', null,
  'only members of the household take part'
);
select is(
  (select count(*)::integer from public.goal_participants),
  7, 'members see who takes part in their household''s goals only'
);
select throws_ok(
  $$ select public.add_shared_goal('Holiday', 5, '[{"user_id": "22222222-2222-2222-2222-222222222222"},
       {"user_id": "22222222-2222-2222-2222-222222222222"}]') $$,
  '23514', null,
  'nobody takes part twice'
);
-- Anna edits the Zoo trip: a new reward, fewer points and smaller minimums, then makes it Ben's own.
select public.update_goal(
  (select id from public.goals where title = 'Zoo trip'), 'Zoo day', 6, null,
  '[{"user_id": "11111111-1111-1111-1111-111111111111", "min_points": 2},
    {"user_id": "22222222-2222-2222-2222-222222222222", "min_points": 3}]'
);
do $$
begin
  perform set_config('test.zoo', id::text, true) from public.goals where title = 'Zoo day';
end
$$;
select results_eq(
  $$ select title, target_points, points, reached, participants from public.household_goals() where title = 'Zoo day' $$,
  $$ values ('Zoo day', 6, 9, true,
    '[{"user_id": "11111111-1111-1111-1111-111111111111", "display_name": "Anna", "points": 6, "min_points": 2},
      {"user_id": "22222222-2222-2222-2222-222222222222", "display_name": null, "points": 3, "min_points": 3}]'::jsonb) $$,
  'an adult changes an open goal''s reward, points and participants, and its progress still counts'
);
select public.update_goal(
  (select id from public.goals where title = 'Zoo day'), 'Zoo day', 6, '22222222-2222-2222-2222-222222222222', '[]'
);
select results_eq(
  $$ select owner_id::text, points, participants from public.household_goals() where title = 'Zoo day' $$,
  $$ values ('22222222-2222-2222-2222-222222222222', 3, null::jsonb) $$,
  'a shared goal can become one member''s personal goal'
);
select is(
  (select count(*)::integer from public.goal_participants gp join public.goals g on g.id = gp.goal_id
    where g.title = 'Zoo day'),
  0, 'a personal goal keeps no participants'
);
select throws_ok(
  $$ select public.update_goal((select id from public.goals where title = 'Zoo day'), 'Zoo day', 6,
       '33333333-3333-3333-3333-333333333333', '[]') $$,
  '42501', null,
  'a goal is not changed to someone outside the household'
);
select throws_ok(
  $$ select public.update_goal((select id from public.goals where title = 'Zoo day'), 'Zoo day', 4, null,
       '[{"user_id": "11111111-1111-1111-1111-111111111111", "min_points": 3},
         {"user_id": "22222222-2222-2222-2222-222222222222", "min_points": 3}]') $$,
  '23514', null,
  'a changed goal''s minimums together are at most its points'
);
select throws_ok(
  $$ select public.update_goal((select id from public.goals where title = 'Zoo day'), '', 6,
       '22222222-2222-2222-2222-222222222222', '[]') $$,
  '23514', null,
  'a changed goal still needs a reward'
);
select throws_ok(
  format($$ select public.update_goal(%L, 'Pizza party', 5, null, '[{"user_id": "11111111-1111-1111-1111-111111111111"}]') $$,
    current_setting('test.pizza')),
  'P0002', null,
  'claimed goals stay as they were'
);

-- Ben deletes his account: he no longer takes part, and his points stop counting.
reset role;
delete from auth.users where id = '22222222-2222-2222-2222-222222222222';
set local role authenticated;
select results_eq(
  $$ select points, participants from public.household_goals() where title = 'Bike' $$,
  $$ values (0, '[]'::jsonb) $$,
  'a participant who deletes their account stops taking part'
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
select throws_ok(
  format($$ select public.update_goal(%L, 'Ours', 6, '33333333-3333-3333-3333-333333333333', '[]') $$,
    current_setting('test.zoo')),
  'P0002', null,
  'members cannot change another household''s goal'
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
