-- The tasks a member helped with, for their Me page. Run with `npm run db:test` (needs Docker). Anna (an adult) and
-- Ben and Eve (children) share a household; Carol has her own. Anna does the laundry, an adults-only task, and Ben
-- helps; Carol's helper in her own household must not show up for Ben.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carol@example.com'),
  ('55555555-5555-5555-5555-555555555555', 'eve@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select public.create_household('Carol''s flat');
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');
insert into public.tasks (title, type, points) values ('Laundry', 'physical', 5), ('Dishes', 'physical', 2);

reset role;
insert into public.household_members (household_id, user_id, is_child)
  select household_id, member.id, true from public.tasks, (values
    ('22222222-2222-2222-2222-222222222222'::uuid), ('55555555-5555-5555-5555-555555555555'::uuid)
  ) as member (id)
  where title = 'Laundry';
do $$
begin
  perform set_config('test.laundry', id::text, true) from public.tasks where title = 'Laundry';
  perform set_config('test.dishes', id::text, true) from public.tasks where title = 'Dishes';
end
$$;
set local role authenticated;

select public.complete_task(current_setting('test.laundry')::uuid, current_date);
select public.complete_task(current_setting('test.dishes')::uuid, current_date);
select public.set_task_helpers(
  current_setting('test.laundry')::uuid, '[{"user_id": "22222222-2222-2222-2222-222222222222", "points": 2}]'
);

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select results_eq(
  $$ select title, type, points, completed_by::text from public.own_helped_tasks(20) $$,
  $$ values ('Laundry', 'physical', 2, '11111111-1111-1111-1111-111111111111') $$,
  'a child sees the adults-only task they helped with, their share and who did it'
);
select is_empty(
  $$ select 1 from public.tasks where id = current_setting('test.laundry')::uuid $$,
  'the task itself stays hidden from the child'
);
select is_empty(
  $$ select 1 from public.own_helped_tasks(0) $$,
  'the number of tasks is limited'
);

set local request.jwt.claims = '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';
select is_empty(
  $$ select 1 from public.own_helped_tasks(20) $$,
  'another child does not see a task they did not help with'
);

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is_empty(
  $$ select 1 from public.own_helped_tasks(20) $$,
  'the doer did not help with their own task'
);

set local role anon;
select throws_ok(
  $$ select public.own_helped_tasks(20) $$,
  '42501', null,
  'signed-out visitors cannot list helped tasks'
);

select * from finish();
rollback;
