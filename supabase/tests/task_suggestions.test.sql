-- Task suggestions. Run with `npm run db:test` (needs Docker).
-- Anna and Ben share a household and Carl has his own.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carl@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select public.create_household('The Joneses');
insert into public.tasks (title, type, points) values ('Mow the lawn', 'physical', 3);

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');
-- Anna takes out the trash twice (the second time with different points and capitals) and adds a daily task.
insert into public.tasks (title, type, points) values ('Take out trash', 'physical', 1);
select public.complete_task((select id from public.tasks where title = 'Take out trash'), current_date);
insert into public.tasks (title, type, points) values ('Take Out Trash', 'physical', 2);
insert into public.tasks (title, type, points, repeat_every_days) values ('Feed the cat', 'physical', 1, 1);
select public.complete_task((select id from public.tasks where title = 'Feed the cat'), current_date);
insert into public.tasks (title, type, points, is_private) values ('Buy a present', 'meta', null, true);
insert into public.tasks (title, type, points) values ('Added by mistake', 'meta', 1);
select public.delete_task((select id from public.tasks where title = 'Added by mistake'));

reset role;
insert into public.household_members (household_id, user_id)
  select household_id, '22222222-2222-2222-2222-222222222222' from public.tasks where title = 'Take out trash';
-- Spread out when they were added, so the order doesn't depend on timing within the test.
update public.tasks set created_at = now() - interval '3 days' where title = 'Take out trash';
update public.tasks set created_at = now() - interval '2 days' where title = 'Feed the cat';
update public.tasks set created_at = now() - interval '1 day' where title = 'Buy a present';
set local role authenticated;

select results_eq(
  $$ select title, points::integer, repeat_every_days::integer, is_private, times_added, is_open
     from public.task_suggestions() $$,
  $$ values
    ('Take Out Trash'::text, 2, null::integer, false, 2, true),
    ('Buy a present', null, null, true, 1, true),
    ('Feed the cat', 1, 1, false, 1, true) $$,
  'suggests each title once with its newest details, most often added first, without deleted tasks or repeats'
);

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select results_eq(
  $$ select title from public.task_suggestions() $$,
  $$ values ('Take Out Trash'::text), ('Feed the cat') $$,
  'other members see the shared tasks but not private ones'
);

select public.complete_task((select id from public.tasks where title = 'Take Out Trash'), current_date);
select results_eq(
  $$ select is_open from public.task_suggestions() where title = 'Take Out Trash' $$,
  $$ values (false) $$,
  'a task is no longer open once every occurrence is done'
);

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select results_eq(
  $$ select title from public.task_suggestions() $$,
  $$ values ('Mow the lawn'::text) $$,
  'other households are left out'
);

reset role;
set local role anon;
select throws_ok(
  $$ select * from public.task_suggestions() $$,
  '42501', null,
  'logged-out visitors cannot read suggestions'
);

select * from finish();
rollback;
