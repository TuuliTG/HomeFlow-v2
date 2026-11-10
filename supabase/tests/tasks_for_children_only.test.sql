-- Tasks for children are children's only. Run with `npm run db:test` (needs Docker). Anna (adult) and Ben (a child)
-- share a household.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');
insert into public.tasks (title, type, points, for_children) values ('Feed the cat', 'physical', 2, true);
insert into public.tasks (title, type, points) values ('Empty the dishwasher', 'physical', 1);

reset role;
insert into public.household_members (household_id, user_id, is_child)
  select household_id, '22222222-2222-2222-2222-222222222222', true from public.tasks where title = 'Feed the cat';
do $$
begin
  perform set_config('test.cat', id::text, true) from public.tasks where title = 'Feed the cat';
  perform set_config('test.dishwasher', id::text, true) from public.tasks where title = 'Empty the dishwasher';
end
$$;
set local role authenticated;

-- Anna adds the cat for the children: she can't pick it up or mark it done, but she can change it.
select throws_ok(
  format('select public.pick_up_task(%L)', current_setting('test.cat')),
  '42501', null,
  'an adult cannot pick up a task for children'
);
select throws_ok(
  format('select public.complete_task(%L, current_date)', current_setting('test.cat')),
  '42501', null,
  'an adult cannot mark a task for children done'
);
select lives_ok(
  format(
    $$ select public.update_task(%L, 'Feed the cat', null, 'physical', 3::smallint, null, null, true, null) $$,
    current_setting('test.cat')
  ),
  'an adult can edit a task for children'
);

-- Ben does it.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok(
  format('select public.pick_up_task(%L)', current_setting('test.cat')),
  'a child can pick up a task for children'
);
select lives_ok(
  format('select public.complete_task(%L, current_date)', current_setting('test.cat')),
  'a child can mark a task for children done'
);
select results_eq(
  format($$ select completed_by::text, points from public.tasks where id = %L $$, current_setting('test.cat')),
  $$ values ('22222222-2222-2222-2222-222222222222', 3::smallint) $$,
  'the child earns the task''s points'
);

-- Anna picks up the dishwasher, plans it and sets a reminder, then makes it a task for the children.
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.pick_up_task(current_setting('test.dishwasher')::uuid);
select public.set_task_schedule(current_setting('test.dishwasher')::uuid, now() + interval '1 day', 30);
select public.set_task_reminder(current_setting('test.dishwasher')::uuid, now() + interval '1 day');
select lives_ok(
  format(
    $$ select public.update_task(%L, 'Empty the dishwasher', null, 'physical', 1::smallint, null, null, true, null) $$,
    current_setting('test.dishwasher')
  ),
  'an adult can make an adults-only task one for children'
);
select is(
  (select picked_up_by from public.tasks where id = current_setting('test.dishwasher')::uuid),
  null::uuid,
  'making a task one for children puts it back from the adult who had it'
);
reset role;
select is_empty(
  format(
    $$ select 1 from public.task_schedules where task_id = %1$L
       union all select 1 from public.task_reminders where task_id = %1$L $$,
    current_setting('test.dishwasher')
  ),
  'the adult no longer plans or is reminded to do it'
);
set local role authenticated;

-- An adult's private task is theirs to do, even one kept for children from when they were a child.
insert into public.tasks (title, type, points, is_private, for_children)
  values ('Diary', 'meta', null, true, true);
select lives_ok(
  $$ select public.pick_up_task(id) from public.tasks where title = 'Diary' $$,
  'an adult can pick up their own private task'
);
select lives_ok(
  $$ select public.complete_task(id, current_date) from public.tasks where title = 'Diary' $$,
  'an adult can mark their own private task done'
);

select * from finish();
rollback;
