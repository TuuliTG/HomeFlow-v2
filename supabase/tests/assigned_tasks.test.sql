-- Chores an adult gives to one child. Run with `npm run db:test` (needs Docker). Anna (adult), Ben and Dora
-- (children) share a household; Carol has her own.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carol@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'dora@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select public.create_household('Carol''s flat');
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');
insert into public.tasks (title, type, points, for_children) values ('Feed the cat', 'physical', 2, true);

reset role;
insert into public.household_members (household_id, user_id, is_child)
  select household_id, member, true
    from public.tasks,
      unnest(array['22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444']::uuid[]) member
    where title = 'Feed the cat';
do $$
begin
  perform set_config('test.cat', id::text, true) from public.tasks where title = 'Feed the cat';
end
$$;
set local role authenticated;

-- Anna gives Ben a repeating chore; it is picked up for him.
select lives_ok(
  $$ insert into public.tasks (title, type, points, for_children, repeat_every_days, assigned_to)
     values ('Make your bed', 'physical', 1, true, 1, '22222222-2222-2222-2222-222222222222') $$,
  'an adult can give a task for children to a child'
);
reset role;
do $$
begin
  perform set_config('test.bed', id::text, true) from public.tasks where title = 'Make your bed';
end
$$;
set local role authenticated;
select is(
  (select picked_up_by from public.tasks where id = current_setting('test.bed')::uuid),
  '22222222-2222-2222-2222-222222222222'::uuid,
  'a task given to a child is picked up for them'
);
select throws_ok(
  $$ insert into public.tasks (title, type, points, assigned_to)
     values ('Pay the bills', 'meta', 3, '22222222-2222-2222-2222-222222222222') $$,
  '23514', null,
  'only a task for children can be given to a child'
);
select throws_ok(
  $$ insert into public.tasks (title, type, points, for_children, assigned_to)
     values ('Dust', 'physical', 1, true, '11111111-1111-1111-1111-111111111111') $$,
  '42501', null,
  'a task can be given only to a child'
);
select throws_ok(
  $$ insert into public.tasks (title, type, points, for_children, assigned_to)
     values ('Dust', 'physical', 1, true, '33333333-3333-3333-3333-333333333333') $$,
  '42501', null,
  'a task can be given only to someone in the household'
);
select throws_ok(
  $$ select public.request_task(current_setting('test.bed')::uuid, '44444444-4444-4444-4444-444444444444') $$,
  'P0002', null,
  'nobody can be asked to do a task given to a child'
);

-- Ben sees it and can't give it back or give his chores to others.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is(
  (select count(*)::integer from public.tasks where id = current_setting('test.bed')::uuid),
  1,
  'the child sees the task given to them'
);
select throws_ok(
  $$ select public.put_back_task(current_setting('test.bed')::uuid) $$,
  'P0002', null,
  'a child cannot put back a task given to them'
);
select throws_ok(
  $$ select public.request_task(current_setting('test.bed')::uuid, '44444444-4444-4444-4444-444444444444') $$,
  'P0002', null,
  'a child cannot hand over a task given to them'
);
select throws_ok(
  $$ insert into public.tasks (title, type, points, for_children, assigned_to)
     values ('Tidy up', 'physical', null, true, '44444444-4444-4444-4444-444444444444') $$,
  '42501', null,
  'a child cannot give a task to another child'
);

-- Dora doesn't see Ben's chore, nor can she act on it.
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select is(
  (select count(*)::integer from public.tasks where id = current_setting('test.bed')::uuid),
  0,
  'another child does not see a task given to a child'
);
select is(
  (select count(*)::integer from public.tasks where id = current_setting('test.cat')::uuid),
  1,
  'another child still sees the tasks for every child'
);
select throws_ok(
  $$ select public.complete_task(current_setting('test.bed')::uuid, current_date) $$,
  'P0002', null,
  'another child cannot mark a task given to a child done'
);

-- Ben marks it done; the next occurrence is his again.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.complete_task(current_setting('test.bed')::uuid, current_date);
reset role;
do $$
begin
  perform set_config('test.next_bed', id::text, true)
    from public.tasks where previous_task_id = current_setting('test.bed')::uuid;
end
$$;
select is(
  (select array[assigned_to, picked_up_by] from public.tasks where id = current_setting('test.next_bed')::uuid),
  array['22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222']::uuid[],
  'the next occurrence is given to the same child'
);
set local role authenticated;

-- Anna gives it to Dora instead, then to no one in particular.
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok(
  $$ select public.update_task(current_setting('test.next_bed')::uuid, 'Make your bed', null, 'physical',
       1::smallint, null, 1::smallint, true, null, '44444444-4444-4444-4444-444444444444') $$,
  'an adult can give the task to another child'
);
select is(
  (select picked_up_by from public.tasks where id = current_setting('test.next_bed')::uuid),
  '44444444-4444-4444-4444-444444444444'::uuid,
  'the task moves to the other child'
);
select throws_ok(
  $$ select public.update_task(current_setting('test.next_bed')::uuid, 'Make your bed', null, 'physical',
       1::smallint, null, 1::smallint, true, null, '33333333-3333-3333-3333-333333333333') $$,
  'P0002', null,
  'an edit cannot give a task to someone outside the household'
);
select lives_ok(
  $$ select public.update_task(current_setting('test.next_bed')::uuid, 'Make your bed', null, 'physical',
       1::smallint, null, 1::smallint, true, null, null) $$,
  'an adult can give the task to no one in particular'
);
select is(
  (select picked_up_by from public.tasks where id = current_setting('test.next_bed')::uuid),
  null::uuid,
  'a task no longer given to a child is put back'
);

-- A child who becomes an adult keeps their chores picked up, but no longer given to them.
select public.update_task(current_setting('test.next_bed')::uuid, 'Make your bed', null, 'physical',
  1::smallint, null, 1::smallint, true, null, '44444444-4444-4444-4444-444444444444');
select public.set_member_is_child('44444444-4444-4444-4444-444444444444', false);
select is(
  (select array[assigned_to, picked_up_by] from public.tasks where id = current_setting('test.next_bed')::uuid),
  array[null, '44444444-4444-4444-4444-444444444444']::uuid[],
  'a new adult keeps the task picked up, no longer given to them'
);

-- Carol, in another household, can't give a task to Ben.
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select throws_ok(
  $$ insert into public.tasks (title, type, points, for_children, assigned_to)
     values ('Walk the dog', 'physical', 2, true, '22222222-2222-2222-2222-222222222222') $$,
  '42501', null,
  'an adult cannot give a task to a child in another household'
);

select * from finish();
rollback;
