-- Task descriptions. Run with `npm run db:test` (needs Docker).
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'anna@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');

select lives_ok(
  $$ insert into public.tasks (title, description, type, points, repeat_every_days)
     values ('Change bed linen', 'Spare sheets are in the hall cupboard.', 'physical', 4, 14) $$,
  'a task can have a description'
);
select lives_ok(
  $$ insert into public.tasks (title, type, points) values ('Dust', 'physical', 1) $$,
  'the description is optional'
);
select throws_ok(
  $$ insert into public.tasks (title, description, type, points) values ('Dust', '', 'physical', 1) $$,
  '23514', null,
  'an empty description is stored as no description, not as empty text'
);
select throws_ok(
  format($$ insert into public.tasks (title, description, type, points) values ('Dust', %L, 'physical', 1) $$, repeat('x', 501)),
  '23514', null,
  'a description is at most 500 characters'
);

reset role;
do $$
begin
  perform set_config('test.linen', id::text, true) from public.tasks where title = 'Change bed linen';
end
$$;
set local role authenticated;

select lives_ok(
  format(
    $$ select public.update_task(%L, 'Change bed linen', 'Wash at 60°C.', 'physical', 4::smallint, null, 14::smallint) $$,
    current_setting('test.linen')
  ),
  'the description can be edited'
);
select public.complete_task(current_setting('test.linen')::uuid, current_date);
select results_eq(
  format('select description from public.tasks where previous_task_id = %L', current_setting('test.linen')),
  $$ values ('Wash at 60°C.') $$,
  'the next occurrence of a repeating task keeps its description'
);
select lives_ok(
  format(
    $$ select public.update_task(t.id, 'Change bed linen', null, 'physical', 4::smallint, null, 14::smallint)
       from public.tasks t where t.previous_task_id = %L $$,
    current_setting('test.linen')
  ),
  'the description can be removed'
);

select * from finish();
rollback;
