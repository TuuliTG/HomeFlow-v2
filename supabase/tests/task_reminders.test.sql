-- Task reminders. Run with `npm run db:test` (needs Docker).
-- Anna and Ben share a household. Anna has a private task and picks up a shared one; Ben has picked up another.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

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
select public.pick_up_task(current_setting('test.dishes')::uuid);

-- Anna sets reminders for her private task and the task she picked up.
select lives_ok(
  format($$ select public.set_task_reminder(%L, now() + interval '1 hour') $$, current_setting('test.present')),
  'a member can set a reminder for their private task'
);
select lives_ok(
  format($$ select public.set_task_reminder(%L, now() + interval '2 hours') $$, current_setting('test.vacuum')),
  'a member can set a reminder for a task they picked up'
);
select lives_ok(
  format($$ select public.set_task_reminder(%L, now() + interval '3 hours') $$, current_setting('test.vacuum')),
  'setting a reminder again moves it'
);
select results_eq(
  $$ select t.title, r.remind_at > now() + interval '150 minutes'
     from public.task_reminders r join public.tasks t on t.id = r.task_id order by t.title $$,
  $$ values ('Buy a present', false), ('Vacuum', true) $$,
  'the member sees their reminders, one per task'
);
select throws_ok(
  format($$ select public.set_task_reminder(%L, now() + interval '1 hour') $$, current_setting('test.dentist')),
  'P0002', null,
  'a member cannot set a reminder for a shared task nobody has picked up'
);
select throws_ok(
  format($$ select public.set_task_reminder(%L, now() - interval '1 hour') $$, current_setting('test.present')),
  '22023', null,
  'a reminder cannot be in the past'
);
select throws_ok(
  format($$ select public.set_task_reminder(%L, now() + interval '2 years') $$, current_setting('test.present')),
  '22023', null,
  'a reminder must be within the next year'
);
select throws_ok(
  format(
    $$ insert into public.task_reminders (task_id, remind_at) values (%L, now()) $$,
    current_setting('test.dentist')
  ),
  '42501', null,
  'reminders are set only through the function'
);
select throws_ok(
  'select * from public.take_due_reminders()',
  '42501', null,
  'members cannot take due reminders'
);

-- Ben can't see Anna's reminders or set one for her tasks.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is_empty(
  'select * from public.task_reminders',
  'other members cannot see a reminder'
);
select throws_ok(
  format($$ select public.set_task_reminder(%L, now() + interval '1 hour') $$, current_setting('test.vacuum')),
  'P0002', null,
  'a member cannot set a reminder for a task someone else picked up'
);
select throws_ok(
  format($$ select public.set_task_reminder(%L, now() + interval '1 hour') $$, current_setting('test.present')),
  'P0002', null,
  'a member cannot set a reminder for another member''s private task'
);

-- Anna sets one more reminder and removes it, then puts the vacuuming back.
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.set_task_reminder(current_setting('test.dishes')::uuid, now() + interval '1 hour');
select public.clear_task_reminder(current_setting('test.dishes')::uuid);
select public.put_back_task(current_setting('test.vacuum')::uuid);
select results_eq(
  $$ select t.title from public.task_reminders r join public.tasks t on t.id = r.task_id $$,
  $$ values ('Buy a present') $$,
  'removing a reminder or putting the task back removes it'
);

-- Time passes: both of Anna's remaining reminders come due, but she has done the dishes in the meantime.
select public.set_task_reminder(current_setting('test.dishes')::uuid, now() + interval '1 hour');
select public.complete_task(current_setting('test.dishes')::uuid, current_date);
reset role;
update public.task_reminders set remind_at = now() - interval '1 minute';
insert into public.task_reminders (task_id, user_id, remind_at)
  values (current_setting('test.dentist')::uuid, '11111111-1111-1111-1111-111111111111', now() + interval '1 day');
set local role service_role;
select results_eq(
  'select user_id, task_title from public.take_due_reminders()',
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid, 'Buy a present') $$,
  'the due reminders of tasks still to do are taken for sending'
);
select is_empty(
  'select * from public.take_due_reminders()',
  'a reminder is sent once'
);
reset role;
insert into public.task_reminders (task_id, user_id, remind_at)
  values (current_setting('test.present')::uuid, '11111111-1111-1111-1111-111111111111', now() - interval '2 hours');
set local role service_role;
select is_empty(
  'select * from public.take_due_reminders()',
  'a reminder more than an hour late is dropped'
);
reset role;
select results_eq(
  $$ select t.title from public.task_reminders r join public.tasks t on t.id = r.task_id $$,
  $$ values ('Book dentist') $$,
  'due reminders are removed, sent or not, and later ones stay'
);

-- Deleting a task removes its reminders.
delete from public.tasks where id = current_setting('test.dentist')::uuid;
select is_empty('select * from public.task_reminders', 'deleting a task removes its reminders');

select * from finish();
rollback;
