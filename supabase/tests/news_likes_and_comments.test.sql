-- Likes and comments on done tasks (ADR 0007). Run with `npm run db:test` (needs Docker).
-- Anna and Ben share a household and Carl has his own. Ben has done Vacuum and Anna a private task.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carl@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select public.create_household('The Joneses');

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');
insert into public.tasks (title, type, points) values ('Vacuum', 'physical', 3), ('Dust', 'physical', 1);
insert into public.tasks (title, type, points, is_private) values ('Diary', 'meta', null, true);
select public.complete_task(id, current_date) from public.tasks where title = 'Diary';
reset role;
insert into public.household_members (household_id, user_id)
  select household_id, '22222222-2222-2222-2222-222222222222' from public.household_members
  where user_id = '11111111-1111-1111-1111-111111111111';
do $$
begin
  perform set_config('test.vacuum', id::text, true) from public.tasks where title = 'Vacuum';
  perform set_config('test.dust', id::text, true) from public.tasks where title = 'Dust';
  perform set_config('test.diary', id::text, true) from public.tasks where title = 'Diary';
end
$$;
set local role authenticated;

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.complete_task(current_setting('test.vacuum')::uuid, current_date);
select throws_ok(
  $$ insert into public.task_likes (task_id) values (current_setting('test.vacuum')::uuid) $$,
  '42501', null,
  'a member cannot like their own work'
);

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok(
  $$ insert into public.task_likes (task_id) values (current_setting('test.vacuum')::uuid) $$,
  'a member can like a task someone else in their household has done'
);
select throws_ok(
  $$ insert into public.task_likes (task_id) values (current_setting('test.vacuum')::uuid) $$,
  '23505', null,
  'a member likes a task once'
);
select throws_ok(
  $$ insert into public.task_likes (task_id) values (current_setting('test.dust')::uuid) $$,
  '42501', null,
  'an open task cannot be liked'
);
select throws_ok(
  $$ insert into public.task_likes (task_id, user_id)
     values (current_setting('test.vacuum')::uuid, '22222222-2222-2222-2222-222222222222') $$,
  '42501', null,
  'a member cannot like on behalf of someone else'
);
select lives_ok(
  $$ insert into public.task_comments (task_id, body) values (current_setting('test.vacuum')::uuid, 'Thank you!') $$,
  'a member can comment on a done shared task'
);
select throws_ok(
  $$ insert into public.task_comments (task_id, body) values (current_setting('test.diary')::uuid, 'Note to self') $$,
  '42501', null,
  'a private task cannot be commented on'
);
select throws_ok(
  $$ insert into public.task_comments (task_id, body) values (current_setting('test.dust')::uuid, 'Soon?') $$,
  '42501', null,
  'an open task cannot be commented on'
);
select throws_ok(
  $$ insert into public.task_comments (task_id, body) values (current_setting('test.vacuum')::uuid, '   ') $$,
  '23514', null,
  'a comment is not empty'
);
select throws_ok(
  $$ update public.task_comments set body = 'Changed' $$,
  '42501', null,
  'comments cannot be edited'
);

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select results_eq(
  $$ select l.user_id::text, c.body from public.task_likes l, public.task_comments c $$,
  $$ values ('11111111-1111-1111-1111-111111111111', 'Thank you!') $$,
  'whoever did the task sees the like and the comment'
);
select lives_ok(
  $$ insert into public.task_comments (task_id, body) values (current_setting('test.vacuum')::uuid, 'You''re welcome') $$,
  'a member can reply on their own work'
);
with deleted as (delete from public.task_likes returning 1)
select is((select count(*)::int from deleted), 0, 'a member cannot take back someone else''s like');
with deleted as (delete from public.task_comments where body = 'Thank you!' returning 1)
select is((select count(*)::int from deleted), 0, 'a member cannot delete someone else''s comment');

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is(
  (select count(*)::int from public.task_likes) + (select count(*)::int from public.task_comments),
  0,
  'other households see no likes or comments'
);

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
delete from public.task_likes;
delete from public.task_comments;
select results_eq(
  $$ select (select count(*)::int from public.task_likes), (select body from public.task_comments) $$,
  $$ values (0, 'You''re welcome') $$,
  'a member can take back their own like and delete their own comment'
);

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok(
  $$ select 1 from public.task_comments $$,
  '42501', null,
  'visitors cannot read comments'
);

select * from finish();
rollback;
