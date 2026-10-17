-- Scheduling tasks. Run with `npm run db:test` (needs Docker).
-- Anna and Ben share a household. Anna has a private task and picks up a shared one; Ben has picked up another.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');
insert into public.tasks (title, type, points, is_private) values ('Buy a present', 'meta', null, true);
insert into public.tasks (title, type, points) values ('Vacuum', 'physical', 3);
insert into public.tasks (title, type, points) values ('Book dentist', 'meta', 2);
insert into public.tasks (title, type, points) values ('Dishes', 'physical', 1);

reset role;
insert into public.household_members (household_id, user_id)
  select household_id, '22222222-2222-2222-2222-222222222222' from public.tasks where title = 'Vacuum';
do $$
begin
  perform set_config('test.present', id::text, true) from public.tasks where title = 'Buy a present';
  perform set_config('test.vacuum', id::text, true) from public.tasks where title = 'Vacuum';
  perform set_config('test.dentist', id::text, true) from public.tasks where title = 'Book dentist';
  perform set_config('test.dishes', id::text, true) from public.tasks where title = 'Dishes';
end
$$;
set local role authenticated;
select public.pick_up_task(current_setting('test.vacuum')::uuid);

-- Anna schedules her private task and the task she picked up.
select lives_ok(
  format($$ select public.set_task_schedule(%L, now() + interval '1 hour', 30) $$, current_setting('test.present')),
  'a member can schedule their private task'
);
select lives_ok(
  format($$ select public.set_task_schedule(%L, now() + interval '2 hours', 45) $$, current_setting('test.vacuum')),
  'a member can schedule a task they picked up'
);
select lives_ok(
  format($$ select public.set_task_schedule(%L, now() - interval '1 hour', 60) $$, current_setting('test.vacuum')),
  'scheduling a task again moves it, also to earlier today'
);
select results_eq(
  $$ select t.title, s.starts_at < now(), s.duration_minutes
     from public.task_schedules s join public.tasks t on t.id = s.task_id order by t.title $$,
  $$ values ('Buy a present', false, 30), ('Vacuum', true, 60) $$,
  'the member sees their schedule, one block per task'
);
select throws_ok(
  format($$ select public.set_task_schedule(%L, now() + interval '1 hour', 30) $$, current_setting('test.dentist')),
  'P0002', null,
  'a member cannot schedule a shared task nobody has picked up'
);
select throws_ok(
  format($$ select public.set_task_schedule(%L, now() + interval '2 years', 30) $$, current_setting('test.present')),
  '22023', null,
  'a task can be scheduled up to a year away'
);
select throws_ok(
  format($$ select public.set_task_schedule(%L, now(), 4) $$, current_setting('test.present')),
  '22023', null,
  'a scheduled task takes at least 5 minutes'
);
select throws_ok(
  format($$ select public.set_task_schedule(%L, now(), 721) $$, current_setting('test.present')),
  '22023', null,
  'a scheduled task takes at most 12 hours'
);
select throws_ok(
  format(
    $$ insert into public.task_schedules (task_id, starts_at, duration_minutes) values (%L, now(), 30) $$,
    current_setting('test.dentist')
  ),
  '42501', null,
  'schedules are set only through the function'
);

-- Ben picks up the dishes and schedules them; he can't schedule Anna's tasks, and sees only his own schedule.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.pick_up_task(current_setting('test.dishes')::uuid);
select public.set_task_schedule(current_setting('test.dishes')::uuid, now() + interval '1 hour', 15);
select throws_ok(
  format($$ select public.set_task_schedule(%L, now() + interval '1 hour', 30) $$, current_setting('test.vacuum')),
  'P0002', null,
  'a member cannot schedule a task someone else picked up'
);
select throws_ok(
  format($$ select public.set_task_schedule(%L, now() + interval '1 hour', 30) $$, current_setting('test.present')),
  'P0002', null,
  'a member cannot schedule someone else''s private task'
);
select results_eq(
  'select t.title from public.task_schedules s join public.tasks t on t.id = s.task_id',
  $$ values ('Dishes') $$,
  'members see only their own schedule'
);

-- Anna removes one block and gives the other task back, which takes it off her schedule too.
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.clear_task_schedule(current_setting('test.present')::uuid);
select public.put_back_task(current_setting('test.vacuum')::uuid);
select is_empty(
  'select * from public.task_schedules',
  'clearing a schedule or putting the task back removes it'
);
reset role;
select results_eq(
  'select t.title from public.task_schedules s join public.tasks t on t.id = s.task_id',
  $$ values ('Dishes') $$,
  'putting a task back leaves other members'' schedules alone'
);

select * from finish();
rollback;
