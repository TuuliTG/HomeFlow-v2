-- Pictures on tasks. Run with `npm run db:test` (needs Docker). Anna and Dan (adults) and Ben (a child) share a
-- household; Carol has her own. Anna attaches pictures to the laundry, an adults-only task that repeats.
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carol@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'dan@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select public.create_household('Carol''s flat');
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');
insert into public.tasks (title, type, points, repeat_every_days) values ('Laundry', 'physical', 5, 7);
insert into public.tasks (title, type, points, is_private) values ('Buy a present', 'meta', null, true);

reset role;
insert into public.household_members (household_id, user_id, is_child)
  select household_id, '22222222-2222-2222-2222-222222222222', true from public.tasks where title = 'Laundry';
insert into public.household_members (household_id, user_id)
  select household_id, '44444444-4444-4444-4444-444444444444' from public.tasks where title = 'Laundry';
do $$
begin
  perform set_config('test.laundry', id::text, true) from public.tasks where title = 'Laundry';
  perform set_config('test.present', id::text, true) from public.tasks where title = 'Buy a present';
  perform set_config('test.smiths', household_id::text, true) from public.tasks where title = 'Laundry';
  perform set_config('test.carols', household_id::text, true) from public.household_members
    where user_id = '33333333-3333-3333-3333-333333333333';
end
$$;
set local role authenticated;

-- Anna uploads into her household's folder only.
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok(
  format(
    $$ insert into storage.objects (bucket_id, name, owner_id) values
         ('task-images', %L, '11111111-1111-1111-1111-111111111111'),
         ('task-images', %L, '11111111-1111-1111-1111-111111111111'),
         ('task-images', %L, '11111111-1111-1111-1111-111111111111') $$,
    current_setting('test.smiths') || '/a.jpg', current_setting('test.smiths') || '/b.jpg',
    current_setting('test.smiths') || '/secret.jpg'
  ),
  'a member uploads pictures to their household''s folder'
);
select throws_ok(
  format(
    $$ insert into storage.objects (bucket_id, name, owner_id)
         values ('task-images', %L, '11111111-1111-1111-1111-111111111111') $$,
    current_setting('test.carols') || '/a.jpg'
  ),
  '42501', null,
  'a member does not upload to another household''s folder'
);

select lives_ok(
  format(
    $$ select public.set_task_images(%L, array[%L, %L]) $$,
    current_setting('test.laundry'), current_setting('test.smiths') || '/a.jpg', current_setting('test.smiths') || '/b.jpg'
  ),
  'whoever may edit a task attaches pictures they uploaded'
);
select lives_ok(
  format(
    $$ select public.set_task_images(%L, array[%L]) $$,
    current_setting('test.present'), current_setting('test.smiths') || '/secret.jpg'
  ),
  'pictures can be attached to a private task'
);
select results_eq(
  format($$ select path, position::integer from public.task_images where task_id = %L order by position $$,
    current_setting('test.laundry')),
  format($$ values (%L, 0), (%L, 1) $$, current_setting('test.smiths') || '/a.jpg', current_setting('test.smiths') || '/b.jpg'),
  'the pictures keep their order'
);
select throws_ok(
  format(
    $$ select public.set_task_images(%L, array['1', '2', '3', '4']) $$, current_setting('test.laundry')
  ),
  '23514', null,
  'a task has at most three pictures'
);
select throws_ok(
  format(
    $$ select public.set_task_images(%L, array[%L, %L]) $$,
    current_setting('test.laundry'), current_setting('test.smiths') || '/a.jpg', current_setting('test.smiths') || '/a.jpg'
  ),
  '23514', null,
  'a picture is on a task once'
);
select throws_ok(
  format(
    $$ select public.set_task_images(%L, array[%L]) $$,
    current_setting('test.laundry'), current_setting('test.smiths') || '/missing.jpg'
  ),
  '42501', null,
  'a picture is a file that was uploaded'
);
select throws_ok(
  format(
    $$ insert into public.task_images (task_id, path, position) values (%L, 'x', 2) $$,
    current_setting('test.laundry')
  ),
  '42501', null,
  'pictures are set only through set_task_images()'
);
select is(
  (select count(*)::integer from storage.objects where name = current_setting('test.smiths') || '/secret.jpg'),
  1,
  'the uploader sees their files'
);

-- Dan sees the pictures of the shared task, not of Anna's private one, and can't attach Anna's private picture.
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select results_eq(
  $$ select count(*)::integer from public.task_images $$,
  $$ values (2) $$,
  'another adult sees the pictures of the shared task only'
);
select results_eq(
  $$ select name from storage.objects order by name $$,
  format($$ values (%L), (%L) $$, current_setting('test.smiths') || '/a.jpg', current_setting('test.smiths') || '/b.jpg'),
  'another adult sees the files of pictures on tasks they can see'
);
select throws_ok(
  format(
    $$ select public.set_task_images(%L, array[%L]) $$,
    current_setting('test.laundry'), current_setting('test.smiths') || '/secret.jpg'
  ),
  '42501', null,
  'a member attaches only files they uploaded'
);
-- Like the Storage API, which deletes files under the policies.
set local storage.allow_delete_query = 'true';
select is_empty(
  format(
    $$ delete from storage.objects where name = %L returning name $$, current_setting('test.smiths') || '/a.jpg'
  ),
  'a file a task needs is not deleted'
);

-- Ben, a child, sees neither the adults-only task's pictures nor their files, and can't change them.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is_empty($$ select 1 from public.task_images $$, 'a child does not see pictures of tasks they cannot see');
select is_empty($$ select 1 from storage.objects $$, 'a child does not see their files');
select throws_ok(
  format($$ select public.set_task_images(%L, '{}') $$, current_setting('test.laundry')),
  'P0002', null,
  'a child does not change pictures of a task they cannot edit'
);

-- Carol, in another household, sees nothing.
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is_empty($$ select 1 from storage.objects $$, 'another household does not see the files');

-- Anna marks the laundry done; its next occurrence shows the same pictures.
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.complete_task(current_setting('test.laundry')::uuid, current_date);
select results_eq(
  format(
    $$ select i.path from public.task_images i join public.tasks t on t.id = i.task_id
       where t.previous_task_id = %L order by i.position $$,
    current_setting('test.laundry')
  ),
  format($$ values (%L), (%L) $$, current_setting('test.smiths') || '/a.jpg', current_setting('test.smiths') || '/b.jpg'),
  'the next occurrence of a repeating task keeps its pictures'
);
select throws_ok(
  format($$ select public.set_task_images(%L, '{}') $$, current_setting('test.laundry')),
  'P0002', null,
  'a done task''s pictures stay'
);

-- Dan removes a picture from the next occurrence: the file stays while the done task shows it.
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
do $$
begin
  perform set_config('test.next', id::text, true) from public.tasks
    where previous_task_id = current_setting('test.laundry')::uuid;
end
$$;
select lives_ok(
  format(
    $$ select public.set_task_images(%L, array[%L]) $$,
    current_setting('test.next'), current_setting('test.smiths') || '/b.jpg'
  ),
  'another adult removes a picture'
);
select ok(
  private.is_task_image_in_use(current_setting('test.smiths') || '/a.jpg'),
  'a file stays in use while another task shows it'
);

-- Once no task shows a file, a member can delete it.
reset role;
delete from public.tasks where id = current_setting('test.laundry')::uuid;
set local role authenticated;
select ok(
  not private.is_task_image_in_use(current_setting('test.smiths') || '/a.jpg'),
  'a file no task shows is no longer in use'
);
select results_eq(
  format(
    $$ select count(*)::integer from storage.objects where name = %L $$, current_setting('test.smiths') || '/a.jpg'
  ),
  $$ values (1) $$,
  'a member sees a file no task needs, to delete it'
);
select isnt_empty(
  format(
    $$ delete from storage.objects where name = %L returning name $$, current_setting('test.smiths') || '/a.jpg'
  ),
  'a member deletes a file no task needs'
);

select * from finish();
rollback;
