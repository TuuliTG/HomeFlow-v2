-- Live updates (plan step 2): stream task changes to open apps. Realtime checks each subscriber's
-- Row Level Security, so members only receive their own household's tasks.
alter publication supabase_realtime add table public.tasks;
