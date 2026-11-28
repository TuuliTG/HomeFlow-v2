-- Emoji reactions in News (ADR 0008). Run with `npm run db:test` (needs Docker).
-- Anna and Ben share a household; Ben has done Vacuum and Dust.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');
insert into public.tasks (title, type, points) values ('Vacuum', 'physical', 3), ('Dust', 'physical', 1);
reset role;
insert into public.household_members (household_id, user_id)
  select household_id, '22222222-2222-2222-2222-222222222222' from public.household_members
  where user_id = '11111111-1111-1111-1111-111111111111';
do $$
begin
  perform set_config('test.vacuum', id::text, true) from public.tasks where title = 'Vacuum';
  perform set_config('test.dust', id::text, true) from public.tasks where title = 'Dust';
end
$$;
set local role authenticated;

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.complete_task(current_setting('test.vacuum')::uuid, current_date);
select public.complete_task(current_setting('test.dust')::uuid, current_date);

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
insert into public.task_likes (task_id) values (current_setting('test.dust')::uuid);
select is(
  (select emoji from public.task_likes where task_id = current_setting('test.dust')::uuid),
  '👍',
  'a like without an emoji is a thumbs up'
);
select throws_ok(
  $$ insert into public.task_likes (task_id, emoji) values (current_setting('test.vacuum')::uuid, '🍕') $$,
  '23514', null,
  'only the offered emoji can be used'
);
select lives_ok(
  $$ insert into public.task_likes (task_id, emoji) values (current_setting('test.vacuum')::uuid, '❤️') $$,
  'a member can react with an emoji'
);
update public.task_likes set emoji = '🎉' where task_id = current_setting('test.vacuum')::uuid;
select is(
  (select emoji from public.task_likes where task_id = current_setting('test.vacuum')::uuid),
  '🎉',
  'a member can change their emoji'
);
select throws_ok(
  $$ update public.task_likes set emoji = '🍕' $$,
  '23514', null,
  'an emoji can only be changed to an offered one'
);
select throws_ok(
  $$ update public.task_likes set task_id = current_setting('test.dust')::uuid $$,
  '42501', null,
  'a like cannot be moved to another task'
);

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
with changed as (update public.task_likes set emoji = '😂' returning 1)
select is((select count(*)::int from changed), 0, 'a member cannot change someone else''s emoji');
select throws_ok(
  $$ update public.task_likes set user_id = '22222222-2222-2222-2222-222222222222' $$,
  '42501', null,
  'a like cannot be given to someone else'
);

reset role;
update public.tasks set completed_at = null where id = current_setting('test.dust')::uuid;
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select throws_ok(
  $$ update public.task_likes set emoji = '💪' where task_id = current_setting('test.dust')::uuid $$,
  '42501', null,
  'an emoji cannot be changed once the task is no longer done'
);

select * from finish();
rollback;
