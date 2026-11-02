-- Choosing which notifications to get (ADR 0005): one row per user, for all their devices. A user without a row gets
-- every notification, so nobody has to choose before they hear anything. The Edge Functions read it with the service
-- role and skip the members who turned a kind off.
create table public.notification_preferences (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- Someone added a shared task (notify-household).
  task_added boolean not null default true,
  -- A member finished a shared task (notify-household).
  task_completed boolean not null default true,
  -- Someone asks the user to do a task (notify-request).
  task_requested boolean not null default true,
  -- The member the user asked accepted or declined (notify-request).
  request_answered boolean not null default true,
  -- The user's own task reminders (send-reminders).
  reminder boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

-- Users read and save only their own choices; saving is an upsert, so it needs insert and update.
revoke all on table public.notification_preferences from anon, authenticated;
grant select, insert, update on table public.notification_preferences to authenticated;
grant select on table public.notification_preferences to service_role;

create policy "Users can view their own notification preferences"
  on public.notification_preferences for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can save their own notification preferences"
  on public.notification_preferences for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can change their own notification preferences"
  on public.notification_preferences for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
