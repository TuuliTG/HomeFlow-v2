-- Child accounts that sign in with a code. Run with `npm run db:test` (needs Docker).
-- Anna adds Ben to her household as a child, as the add-child Edge Function does; Carol has her own household.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222@child.homeflow.invalid'),
  ('33333333-3333-3333-3333-333333333333', 'carol@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'dan@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select public.create_household('Carol''s flat');
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');

-- Only the Edge Functions, with the service role, add children and take codes.
select throws_ok(
  $$ select * from public.add_child(auth.uid(), '22222222-2222-2222-2222-222222222222', 'Ben') $$,
  '42501', null,
  'members cannot add a child themselves'
);
select throws_ok(
  $$ select public.take_child_sign_in_code('ABCDEFGH') $$,
  '42501', null,
  'members cannot take sign-in codes'
);
select throws_ok(
  $$ select * from private.child_sign_in_codes $$,
  '42501', null,
  'members cannot read sign-in codes'
);

set local role service_role;
select throws_ok(
  $$ select * from public.add_child('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'Ben') $$,
  '42501', null,
  'only an adult in a household can add a child'
);
do $$
begin
  perform set_config('test.code', code, true)
    from public.add_child('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Ben');
end
$$;
select matches(
  current_setting('test.code'),
  '^[A-HJ-NP-Z2-9]{8}$',
  'adding a child gives an 8-character code without look-alike characters'
);
select results_eq(
  $$ select is_child, signs_in_with_code from public.household_members
     where user_id = '22222222-2222-2222-2222-222222222222' $$,
  $$ values (true, true) $$,
  'the child joins the adult''s household as a child who signs in with a code'
);
select results_eq(
  $$ select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222' $$,
  $$ values ('Ben') $$,
  'the child has the name the adult gave'
);
select results_eq(
  format(
    'select public.take_child_sign_in_code(%L)',
    ' ' || lower(left(current_setting('test.code'), 4)) || '-' || right(current_setting('test.code'), 4)
  ),
  $$ values ('22222222-2222-2222-2222-222222222222'::uuid) $$,
  'the code signs in the child, however it is typed'
);
select results_eq(
  format('select public.take_child_sign_in_code(%L)', current_setting('test.code')),
  $$ values (null::uuid) $$,
  'a code works only once'
);
select results_eq(
  $$ select public.take_child_sign_in_code('ABCDEFGH') $$,
  $$ values (null::uuid) $$,
  'an unknown code signs in nobody'
);

-- Anna makes new codes; the newest replaces the earlier one.
set local role authenticated;
select results_eq(
  $$ select public.household_invite_code() is not null $$,
  $$ values (true) $$,
  'an adult sees the invite code'
);
do $$
begin
  perform set_config('test.first', code, true)
    from public.new_child_sign_in_code('22222222-2222-2222-2222-222222222222');
  perform set_config('test.second', code, true)
    from public.new_child_sign_in_code('22222222-2222-2222-2222-222222222222');
end
$$;
select throws_ok(
  $$ select * from public.new_child_sign_in_code('11111111-1111-1111-1111-111111111111') $$,
  'P0002', null,
  'there are no codes for members with an email and password'
);
select throws_ok(
  $$ select * from public.new_child_sign_in_code('33333333-3333-3333-3333-333333333333') $$,
  'P0002', null,
  'there are no codes for someone in another household'
);

-- Carol, an adult in her own household, can't make a code for Ben.
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select throws_ok(
  $$ select * from public.new_child_sign_in_code('22222222-2222-2222-2222-222222222222') $$,
  'P0002', null,
  'an adult cannot make a code for a child in another household'
);
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

set local role service_role;
select results_eq(
  format('select public.take_child_sign_in_code(%L)', current_setting('test.first')),
  $$ values (null::uuid) $$,
  'a new code replaces the earlier one'
);
-- An expired code doesn't work either.
reset role;
update private.child_sign_in_codes set expires_at = now() - interval '1 second';
set local role service_role;
select results_eq(
  format('select public.take_child_sign_in_code(%L)', current_setting('test.second')),
  $$ values (null::uuid) $$,
  'a code works for 15 minutes only'
);
reset role;
select is_empty(
  $$ select * from private.child_sign_in_codes $$,
  'expired codes are removed'
);

-- Ben, signed in, sees his household without its invite code and can't make codes.
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select results_eq(
  $$ select name from public.households $$,
  $$ values ('The Smiths') $$,
  'the child sees their household'
);
select results_eq(
  $$ select public.household_invite_code() $$,
  $$ values (null::text) $$,
  'a child does not get the invite code'
);
select throws_ok(
  $$ select invite_code from public.households $$,
  '42501', null,
  'nobody reads the invite code directly'
);
select throws_ok(
  $$ select * from public.new_child_sign_in_code('22222222-2222-2222-2222-222222222222') $$,
  '42501', null,
  'a child cannot make sign-in codes'
);

select * from finish();
rollback;
