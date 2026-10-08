-- Push subscriptions belong to one user each. Run with `npm run db:test` (needs Docker).
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ select public.save_push_subscription('https://push.example.com/anna-phone', 'key-1', 'auth-1') $$,
  'a user can save a device subscription'
);
select lives_ok(
  $$ select public.save_push_subscription('https://push.example.com/anna-phone', 'key-2', 'auth-2') $$,
  'saving the same device again updates it'
);
select results_eq(
  $$ select endpoint, p256dh from public.push_subscriptions $$,
  $$ values ('https://push.example.com/anna-phone', 'key-2') $$,
  'the user sees their device once, with its latest keys'
);
select throws_ok(
  $$ insert into public.push_subscriptions (endpoint, p256dh, auth)
     values ('https://push.example.com/direct', 'k', 'a') $$,
  '42501', null,
  'subscriptions are saved only through save_push_subscription()'
);
select throws_ok(
  $$ update public.push_subscriptions set p256dh = 'changed' $$,
  '42501', null,
  'subscriptions cannot be edited directly'
);
select throws_ok(
  $$ select public.save_push_subscription('http://push.example.com/insecure', 'k', 'a') $$,
  '23514', null,
  'only https push endpoints are accepted'
);

-- Ben must not see or remove Anna's device; when he uses her phone, it becomes his.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is_empty($$ select 1 from public.push_subscriptions $$, 'another user''s devices are invisible');
with deleted as (delete from public.push_subscriptions returning 1)
select is((select count(*)::int from deleted), 0, 'another user''s devices cannot be removed');
select lives_ok(
  $$ select public.save_push_subscription('https://push.example.com/anna-phone', 'key-3', 'auth-3') $$,
  'a device a previous user subscribed can be saved by the user logged in now'
);
select results_eq(
  $$ select endpoint from public.push_subscriptions $$,
  $$ values ('https://push.example.com/anna-phone') $$,
  'the device now belongs to the current user'
);

-- Anna no longer has the device, so it won't get her notifications.
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is_empty($$ select 1 from public.push_subscriptions $$, 'the device left the previous user');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
with deleted as (delete from public.push_subscriptions returning 1)
select is((select count(*)::int from deleted), 1, 'a user can remove their own device');

-- Visitors who are not logged in.
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok(
  $$ select public.save_push_subscription('https://push.example.com/x', 'k', 'a') $$,
  '42501', null,
  'visitors cannot save subscriptions'
);

select * from finish();
rollback;
