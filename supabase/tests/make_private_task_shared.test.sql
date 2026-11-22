-- Making a private task shared when editing it. Run with `npm run db:test` (needs Docker).
-- Anna (adult) and Ben (child) share a household and each have a private task.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');
insert into public.tasks (title, type, points, is_private) values ('Buy a present', 'meta', null, true);
insert into public.tasks (title, type, points) values ('Vacuum', 'physical', 3);

reset role;
insert into public.household_members (household_id, user_id, is_child)
  select household_id, '22222222-2222-2222-2222-222222222222', true from public.tasks where title = 'Vacuum';
insert into public.tasks (household_id, title, type, points, created_by, is_private, for_children)
  select household_id, 'Tidy my desk', 'physical', null, '22222222-2222-2222-2222-222222222222', true, true
  from public.tasks where title = 'Vacuum';
do $$
begin
  perform set_config('test.present', id::text, true) from public.tasks where title = 'Buy a present';
  perform set_config('test.vacuum', id::text, true) from public.tasks where title = 'Vacuum';
  perform set_config('test.desk', id::text, true) from public.tasks where title = 'Tidy my desk';
end
$$;
set local role authenticated;

-- Anna's private task stays private unless she says otherwise, and needs points to be made shared.
select lives_ok(
  format(
    $$ select public.update_task(%L, 'Buy a present', null, 'meta', null, null, null) $$,
    current_setting('test.present')
  ),
  'an edit that does not say keeps a private task private'
);
select throws_ok(
  format(
    $$ select public.update_task(%L, 'Buy a present', null, 'meta', null, null, null,
         task_is_private => false) $$,
    current_setting('test.present')
  ),
  'P0002', null,
  'an adult''s task made shared needs points'
);
select lives_ok(
  format(
    $$ select public.update_task(%L, 'Buy a present', null, 'meta', 2::smallint, null, null,
         task_for_children => false, task_is_private => false) $$,
    current_setting('test.present')
  ),
  'whoever added a private task can make it shared'
);
select results_eq(
  format('select is_private, points from public.tasks where id = %L', current_setting('test.present')),
  $$ values (false, 2::smallint) $$,
  'the task made shared has its points'
);

-- A shared task can't be made private.
select lives_ok(
  format(
    $$ select public.update_task(%L, 'Vacuum', null, 'physical', 3::smallint, null, null,
         task_is_private => true) $$,
    current_setting('test.vacuum')
  ),
  'an edit asking to make a shared task private still saves'
);
select results_eq(
  format('select is_private from public.tasks where id = %L', current_setting('test.vacuum')),
  $$ values (false) $$,
  'a shared task stays shared'
);

-- Ben's private task made shared is given to him, and waits for an adult to award its points.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok(
  format(
    $$ select public.update_task(%L, 'Tidy my desk', null, 'physical', null, null, null,
         task_is_private => false) $$,
    current_setting('test.desk')
  ),
  'a child can make their private task shared'
);
select results_eq(
  format(
    'select is_private, points, assigned_to, picked_up_by from public.tasks where id = %L',
    current_setting('test.desk')
  ),
  $$ values (false, null::smallint, '22222222-2222-2222-2222-222222222222'::uuid,
             '22222222-2222-2222-2222-222222222222'::uuid) $$,
  'a child''s task made shared is given to them, without points yet'
);

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select results_eq(
  $$ select title from public.tasks order by title $$,
  $$ values ('Buy a present'), ('Tidy my desk'), ('Vacuum') $$,
  'the others see a task once it is made shared'
);

select * from finish();
rollback;
