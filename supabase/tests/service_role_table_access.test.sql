-- What the Edge Functions may do with the service role. Run with `npm run db:test` (needs Docker).
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select ok(
  has_table_privilege('service_role', 'public.tasks', 'select'),
  'notify-household can read tasks'
);
select ok(
  has_table_privilege('service_role', 'public.household_members', 'select'),
  'notify-household can read household members'
);
select ok(
  has_table_privilege('service_role', 'public.profiles', 'select'),
  'notify-household can read display names'
);
select ok(
  has_table_privilege('service_role', 'public.push_subscriptions', 'select')
    and has_table_privilege('service_role', 'public.push_subscriptions', 'delete'),
  'the functions can read devices and forget gone ones'
);
select ok(
  not has_table_privilege('service_role', 'public.tasks', 'update')
    and not has_table_privilege('service_role', 'public.tasks', 'delete'),
  'the functions cannot change tasks'
);
select ok(
  has_table_privilege('service_role', 'public.task_likes', 'select')
    and has_table_privilege('service_role', 'public.task_comments', 'select')
    and has_table_privilege('service_role', 'public.task_helpers', 'select'),
  'notify-praise can read likes, comments and helpers'
);
select ok(
  not has_table_privilege('service_role', 'public.task_likes', 'delete')
    and not has_table_privilege('service_role', 'public.task_comments', 'delete')
    and not has_table_privilege('service_role', 'public.task_helpers', 'insert'),
  'notify-praise cannot change likes, comments or helpers'
);
select ok(
  not has_table_privilege('service_role', 'public.task_reminders', 'select'),
  'reminders are taken only through take_due_reminders()'
);

select * from finish();
rollback;
