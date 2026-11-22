-- Making a private task shared when editing it. Run with `npm run db:test` (needs Docker).
-- Anna (adult) and Ben (child) share a household and each have private tasks.
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
insert into public.tasks (title, type, points, is_private, repeat_every_days)
  values ('Water my plants', 'physical', null, true, 7);

reset role;
insert into public.household_members (household_id, user_id, is_child, can_add_tasks)
  select household_id, '22222222-2222-2222-2222-222222222222', true, true from public.tasks where title = 'Vacuum';
insert into public.tasks (household_id, title, type, points, created_by, is_private, for_children)
  select t.household_id, n.title, 'physical', null, n.created_by, true, true
  from public.tasks t
  cross join (values ('Tidy my desk', '22222222-2222-2222-2222-222222222222'::uuid),
                     ('Read a book', '22222222-2222-2222-2222-222222222222'::uuid),
                     -- Added while Anna was a child.
                     ('Sort my photos', '11111111-1111-1111-1111-111111111111'::uuid)) as n(title, created_by)
  where t.title = 'Vacuum';
do $$
begin
  perform set_config('test.present', id::text, true) from public.tasks where title = 'Buy a present';
  perform set_config('test.vacuum', id::text, true) from public.tasks where title = 'Vacuum';
  perform set_config('test.plants', id::text, true) from public.tasks where title = 'Water my plants';
  perform set_config('test.desk', id::text, true) from public.tasks where title = 'Tidy my desk';
  perform set_config('test.book', id::text, true) from public.tasks where title = 'Read a book';
  perform set_config('test.photos', id::text, true) from public.tasks where title = 'Sort my photos';
end
$$;
set local role authenticated;

-- Anna's private task stays private unless she says otherwise, and needs points to be made shared.
select public.set_task_reminder(current_setting('test.present')::uuid, now() + interval '1 day');
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
  format('select is_private, points, picked_up_by from public.tasks where id = %L', current_setting('test.present')),
  $$ values (false, 2::smallint, null::uuid) $$,
  'the task made shared has its points and is open to anyone'
);
select is_empty(
  format('select 1 from public.task_reminders where task_id = %L', current_setting('test.present')),
  'the reminder of an adult''s task made shared goes, as it is no longer theirs to do'
);

-- A private task added while Anna was a child becomes the adults' when she makes it shared.
select lives_ok(
  format(
    $$ select public.update_task(%L, 'Sort my photos', null, 'physical', 3::smallint, null, null,
         task_for_children => true, task_is_private => false) $$,
    current_setting('test.photos')
  ),
  'an adult can make a private task for children shared'
);
select results_eq(
  format('select is_private, for_children, assigned_to from public.tasks where id = %L', current_setting('test.photos')),
  $$ values (false, false, null::uuid) $$,
  'an adult''s private task made shared is for the adults'
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

-- A repeating private task: its done occurrence stays private, and the done one can't be undone any more.
select public.complete_task(current_setting('test.plants')::uuid, current_date);
do $$
begin
  perform set_config('test.next_plants', id::text, true) from public.tasks
    where previous_task_id = current_setting('test.plants')::uuid;
end
$$;
select lives_ok(
  format(
    $$ select public.update_task(%L, 'Water my plants', null, 'physical', 1::smallint, null, 7::smallint,
         task_for_children => false, task_is_private => false) $$,
    current_setting('test.next_plants')
  ),
  'the next occurrence of a private task can be made shared'
);
select results_eq(
  format('select is_private from public.tasks where id = %L', current_setting('test.plants')),
  $$ values (true) $$,
  'the done occurrence stays private'
);
select throws_ok(
  format('select public.undo_complete_task(%L)', current_setting('test.plants')),
  '55006', null,
  'a task whose next occurrence was made shared cannot be undone, which would hide it again'
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

-- Only while he may add tasks.
reset role;
update public.household_members set can_add_tasks = false
  where user_id = '22222222-2222-2222-2222-222222222222';
set local role authenticated;
select throws_ok(
  format(
    $$ select public.update_task(%L, 'Read a book', null, 'physical', null, null, null,
         task_is_private => false) $$,
    current_setting('test.book')
  ),
  '42501', null,
  'a child who may not add tasks cannot make one shared'
);
select lives_ok(
  format(
    $$ select public.update_task(%L, 'Read two books', null, 'physical', null, null, null,
         task_is_private => true) $$,
    current_setting('test.book')
  ),
  'a child who may not add tasks can still edit their private task'
);
select results_eq(
  format('select is_private from public.tasks where id = %L', current_setting('test.book')),
  $$ values (true) $$,
  'and it stays private'
);

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select results_eq(
  $$ select title from public.tasks where completed_at is null and not is_private order by title $$,
  $$ values ('Buy a present'), ('Sort my photos'), ('Tidy my desk'), ('Vacuum'), ('Water my plants') $$,
  'the others see a task once it is made shared'
);

select * from finish();
rollback;
