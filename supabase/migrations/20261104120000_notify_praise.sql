-- Notifications for a thumbs up or comment in News (ADR 0005, ADR 0008): the notify-praise Edge Function, called by a
-- Database Webhook on insert into task_likes and task_comments, tells whoever did the task, its helpers and earlier
-- commenters. Members can turn each kind off; like the other kinds, they are on until a member chooses.
alter table public.notification_preferences
  -- Someone gave a thumbs up to a task the user did or helped with (notify-praise).
  add column task_liked boolean not null default true,
  -- Someone commented on a task the user did, helped with or commented on (notify-praise).
  add column task_commented boolean not null default true;

-- The function reads the like or comment (to skip one taken back before the webhook arrived), the task's helpers and
-- who commented on it.
grant select on table public.task_likes, public.task_comments, public.task_helpers to service_role;
