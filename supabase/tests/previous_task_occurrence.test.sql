-- Who did the previous occurrence of a repeating task. Run with `npm run db:test` (needs Docker).
-- Anna and Ben share a household; Carol has her own.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carol@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select public.create_household('Carol''s flat');

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');
insert into public.tasks (title, type, points, repeat_every_days) values ('Vacuum', 'physical', 3, 7);
insert into public.tasks (title, type, points, repeat_every_days, is_private)
  values ('Water my plants', 'physical', null, 7, true);
insert into public.tasks (title, type, points) values ('Fix the shelf', 'physical', 3);

reset role;
insert into public.household_members (household_id, user_id)
  select household_id, '22222222-2222-2222-2222-222222222222' from public.tasks where title = 'Vacuum';
set local role authenticated;

-- Ben marks the shared task done; Anna her private one.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.complete_task(id, current_date) from public.tasks where title = 'Vacuum';
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.complete_task(id, current_date) from public.tasks where title = 'Water my plants';

select is(
  (select p.completed_by from public.tasks t, public.previous_occurrence(t) p
   where t.title = 'Vacuum' and t.completed_at is null),
  '22222222-2222-2222-2222-222222222222'::uuid,
  'a member sees who did the previous occurrence'
);
select is(
  (select count(*)::integer from public.tasks t, public.previous_occurrence(t) p where t.title = 'Fix the shelf'),
  0,
  'a first occurrence has none'
);

-- The function only follows previous_task_id; RLS decides what the caller sees. Call it with a task row naming each
-- done occurrence, as someone who shouldn't see it.
reset role;
do $$
begin
  perform set_config('test.vacuum', previous_task_id::text, true)
    from public.tasks where title = 'Vacuum' and completed_at is null;
  perform set_config('test.plants', previous_task_id::text, true)
    from public.tasks where title = 'Water my plants' and completed_at is null;
end
$$;
create function pg_temp.previous_of(task_id text) returns setof public.tasks language sql as $$
  select * from public.previous_occurrence(
    jsonb_populate_record(null::public.tasks, jsonb_build_object('previous_task_id', task_id)));
$$;
grant execute on function pg_temp.previous_of(text) to authenticated, anon;
set local role authenticated;

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select isnt_empty(
  format('select * from pg_temp.previous_of(%L)', current_setting('test.plants')),
  'whoever added a private task sees it'
);

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is_empty(
  format('select * from pg_temp.previous_of(%L)', current_setting('test.vacuum')),
  'another household cannot see it'
);

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is_empty(
  format('select * from pg_temp.previous_of(%L)', current_setting('test.plants')),
  'another member cannot see a private one'
);

reset role;
set local role anon;
select throws_ok(
  format('select * from pg_temp.previous_of(%L)', current_setting('test.vacuum')),
  '42501', null,
  'someone not logged in cannot call it'
);

select * from finish();
rollback;
