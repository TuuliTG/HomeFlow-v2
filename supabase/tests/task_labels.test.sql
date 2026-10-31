-- Task labels. Run with `npm run db:test` (needs Docker).
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_household('The Smiths');

select lives_ok(
  $$ insert into public.tasks (title, type, points, repeat_every_days, labels, custom_labels)
     values ('Empty the dishwasher', 'physical', 2, 1, '{kitchen,cleaning}', '{Dishwasher}') $$,
  'a task can have ready-made and own labels'
);
select results_eq(
  $$ select labels, custom_labels from public.tasks where title = 'Empty the dishwasher' $$,
  $$ values ('{kitchen,cleaning}'::text[], '{Dishwasher}'::text[]) $$,
  'the labels are saved'
);
select lives_ok(
  $$ insert into public.tasks (title, type, points) values ('Dust', 'physical', 1) $$,
  'labels are optional'
);
select throws_ok(
  $$ insert into public.tasks (title, type, points, labels) values ('Dust', 'physical', 1, '{<b>}') $$,
  '23514', null,
  'a ready-made label is a name from the app''s set, not markup'
);
select throws_ok(
  $$ insert into public.tasks (title, type, points, labels) values ('Dust', 'physical', 1, '{kitchen,kitchen}') $$,
  '23514', null,
  'a task has each label once'
);
select throws_ok(
  $$ insert into public.tasks (title, type, points, custom_labels) values ('Dust', 'physical', 1, '{Sauna,sauna}') $$,
  '23514', null,
  'a task has each own label once, ignoring case'
);
select throws_ok(
  $$ insert into public.tasks (title, type, points, custom_labels) values ('Dust', 'physical', 1, '{" Sauna"}') $$,
  '23514', null,
  'an own label has no spaces around it'
);
select throws_ok(
  $$ insert into public.tasks (title, type, points, custom_labels)
     values ('Dust', 'physical', 1, array[repeat('a', 31)]) $$,
  '23514', null,
  'an own label is at most 30 characters'
);
select throws_ok(
  $$ insert into public.tasks (title, type, points, labels)
     values ('Dust', 'physical', 1, '{a,b,c,d,e,f,g,h,i,j,k}') $$,
  '23514', null,
  'a task has at most ten labels'
);

reset role;
do $$
begin
  perform set_config('test.dishes', id::text, true) from public.tasks where title = 'Empty the dishwasher';
end
$$;
set local role authenticated;

select lives_ok(
  format(
    $$ select public.update_task(%L, 'Empty the dishwasher', null, 'physical', 2::smallint, null, 1::smallint,
         task_labels => '{kitchen}', task_custom_labels => '{Dishwasher,Evenings}') $$,
    current_setting('test.dishes')
  ),
  'the labels can be changed'
);
select public.update_task(
  current_setting('test.dishes')::uuid, 'Empty the dishwasher', null, 'physical', 2::smallint, null, 1::smallint
);
select results_eq(
  format('select labels, custom_labels from public.tasks where id = %L', current_setting('test.dishes')),
  $$ values ('{kitchen}'::text[], '{Dishwasher,Evenings}'::text[]) $$,
  'an edit that doesn''t send labels keeps them'
);
select public.complete_task(current_setting('test.dishes')::uuid, current_date);
select results_eq(
  format('select labels, custom_labels from public.tasks where previous_task_id = %L', current_setting('test.dishes')),
  $$ values ('{kitchen}'::text[], '{Dishwasher,Evenings}'::text[]) $$,
  'the next occurrence of a repeating task keeps its labels'
);
select results_eq(
  $$ select labels, custom_labels from public.task_suggestions() where title = 'Empty the dishwasher' $$,
  $$ values ('{kitchen}'::text[], '{Dishwasher,Evenings}'::text[]) $$,
  'adding a task again offers its labels'
);

-- Ben joins; Anna's private task's own label stays hidden from him.
insert into public.tasks (title, type, is_private, custom_labels) values ('Book a dentist', 'meta', true, '{Health}');
insert into public.tasks (title, type, points, custom_labels) values ('Wipe the table', 'physical', 1, '{Dishwasher}');
reset role;
insert into public.household_members (household_id, user_id)
  select household_id, '22222222-2222-2222-2222-222222222222' from public.household_members
  where user_id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select results_eq(
  $$ select label from public.custom_task_labels() $$,
  $$ values ('Dishwasher'), ('Evenings') $$,
  'own labels are offered once each, most used first, without other members'' private ones'
);

select * from finish();
rollback;
