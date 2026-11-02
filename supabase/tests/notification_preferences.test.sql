-- Notification preferences belong to one user each. Run with `npm run db:test` (needs Docker).
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.notification_preferences (task_completed) values (false)
     on conflict (user_id) do update set task_completed = excluded.task_completed $$,
  'a user can save their choices'
);
select results_eq(
  $$ select user_id::text, task_added, task_completed, task_requested, request_answered, reminder
     from public.notification_preferences $$,
  $$ values ('11111111-1111-1111-1111-111111111111', true, false, true, true, true) $$,
  'what the user didn''t turn off stays on'
);
select lives_ok(
  $$ insert into public.notification_preferences (task_completed, reminder) values (true, false)
     on conflict (user_id) do update
       set task_completed = excluded.task_completed, reminder = excluded.reminder $$,
  'saving again changes the same row'
);
select results_eq(
  $$ select task_completed, reminder from public.notification_preferences $$,
  $$ values (true, false) $$,
  'the latest choices are kept'
);
select throws_ok(
  $$ insert into public.notification_preferences (user_id)
     values ('22222222-2222-2222-2222-222222222222') $$,
  '42501', null,
  'a user cannot save choices for someone else'
);
select throws_ok(
  $$ delete from public.notification_preferences $$,
  '42501', null,
  'choices cannot be deleted, only changed'
);

-- Ben must not see or change Anna's choices.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is_empty($$ select 1 from public.notification_preferences $$, 'another user''s choices are invisible');
with changed as (update public.notification_preferences set task_added = false returning 1)
select is((select count(*)::int from changed), 0, 'another user''s choices cannot be changed');

reset role;
select ok(
  has_table_privilege('service_role', 'public.notification_preferences', 'select')
    and not has_table_privilege('service_role', 'public.notification_preferences', 'update'),
  'the Edge Functions can read the choices but not change them'
);

select * from finish();
rollback;
