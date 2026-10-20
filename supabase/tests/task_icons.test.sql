-- Task icons. Run with `npm run db:test` (needs Docker).
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'anna@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');

select lives_ok(
  $$ insert into public.tasks (title, type, points, repeat_every_days, icon)
     values ('Make your bed', 'physical', 2, 1, 'bed') $$,
  'a task can have an icon'
);
select lives_ok(
  $$ insert into public.tasks (title, type, points) values ('Dust', 'physical', 1) $$,
  'the icon is optional'
);
select throws_ok(
  $$ insert into public.tasks (title, type, points, icon) values ('Dust', 'physical', 1, '<svg>') $$,
  '23514', null,
  'an icon is a name from the app''s set, not markup'
);

reset role;
do $$
begin
  perform set_config('test.bed', id::text, true) from public.tasks where title = 'Make your bed';
end
$$;
set local role authenticated;

select lives_ok(
  format(
    $$ select public.update_task(%L, 'Make your bed', null, 'physical', 2::smallint, null, 1::smallint, null, 'pillow') $$,
    current_setting('test.bed')
  ),
  'the icon can be changed'
);
select public.complete_task(current_setting('test.bed')::uuid, current_date);
select results_eq(
  format('select icon from public.tasks where previous_task_id = %L', current_setting('test.bed')),
  $$ values ('pillow') $$,
  'the next occurrence of a repeating task keeps its icon'
);
select results_eq(
  $$ select icon from public.task_suggestions() where title = 'Make your bed' $$,
  $$ values ('pillow') $$,
  'adding a task again offers its icon'
);
select lives_ok(
  format(
    $$ select public.update_task(t.id, 'Make your bed', null, 'physical', 2::smallint, null, 1::smallint, null, null)
       from public.tasks t where t.previous_task_id = %L $$,
    current_setting('test.bed')
  ),
  'the icon can be removed'
);

select * from finish();
rollback;
