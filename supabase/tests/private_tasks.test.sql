-- Private tasks. Run with `npm run db:test` (needs Docker).
-- Anna and Ben share a household; Anna adds a private task and a shared one.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');
insert into public.tasks (title, type, points) values ('Vacuum', 'physical', 3);
insert into public.tasks (title, type, points, repeat_every_days, is_private)
  values ('Buy a present', 'meta', null, 7, true);

reset role;
insert into public.household_members (household_id, user_id)
  select household_id, '22222222-2222-2222-2222-222222222222' from public.tasks where title = 'Vacuum';
do $$
begin
  perform set_config('test.present', id::text, true) from public.tasks where title = 'Buy a present';
end
$$;
set local role authenticated;

select results_eq(
  $$ select title, is_private from public.tasks order by title $$,
  $$ values ('Buy a present', true), ('Vacuum', false) $$,
  'whoever adds a private task can see it; tasks are shared by default'
);
select throws_ok(
  $$ insert into public.tasks (title, type, points, is_private) values ('Diary', 'meta', 3, true) $$,
  '23514', null,
  'a private task has no points'
);
select throws_ok(
  $$ insert into public.tasks (title, type, points) values ('Dust', 'physical', null) $$,
  '23514', null,
  'a shared task has points'
);

-- Ben sees only the shared task and can't act on the private one.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select results_eq(
  $$ select title from public.tasks $$,
  $$ values ('Vacuum') $$,
  'other members cannot see a private task'
);
select throws_ok(
  format('select public.pick_up_task(%L)', current_setting('test.present')),
  'P0002', null,
  'other members cannot pick up a private task'
);
select throws_ok(
  format('select public.complete_task(%L, current_date)', current_setting('test.present')),
  'P0002', null,
  'other members cannot mark a private task done'
);
select throws_ok(
  format(
    $$ select public.update_task(%L, 'Hacked', null, 'meta', 2::smallint, null, null) $$,
    current_setting('test.present')
  ),
  'P0002', null,
  'other members cannot edit a private task'
);
select throws_ok(
  format('select public.delete_task(%L)', current_setting('test.present')),
  'P0002', null,
  'other members cannot delete a private task'
);
select throws_ok(
  format('update public.tasks set is_private = false where id = %L', current_setting('test.present')),
  '42501', null,
  'a task cannot be made shared or private after it was added'
);

-- Anna can do everything with it, and its next occurrence stays private.
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok(
  format('select public.pick_up_task(%L)', current_setting('test.present')),
  'whoever added a private task can pick it up'
);
select lives_ok(
  format(
    $$ select public.update_task(%L, 'Buy a birthday present', null, 'meta', null, null, 7::smallint) $$,
    current_setting('test.present')
  ),
  'whoever added a private task can edit it'
);
select lives_ok(
  format('select public.complete_task(%L, current_date)', current_setting('test.present')),
  'whoever added a private task can mark it done'
);
select results_eq(
  format('select is_private from public.tasks where previous_task_id = %L', current_setting('test.present')),
  $$ values (true) $$,
  'the next occurrence of a private repeating task is private too'
);
select lives_ok(
  format('select public.delete_task(id) from public.tasks where previous_task_id = %L', current_setting('test.present')),
  'whoever added a private task can delete it'
);

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select results_eq(
  $$ select count(*)::int from public.tasks where completed_at is not null $$,
  $$ values (0) $$,
  'other members cannot see a private task once it is done either'
);

select * from finish();
rollback;
