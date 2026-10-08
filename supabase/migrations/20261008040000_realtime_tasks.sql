-- Live updates (plan step 2): stream task changes to open apps. Realtime checks each subscriber's
-- Row Level Security, so members only receive their own household's tasks.
-- Idempotent, so it can also be pasted into the dashboard's SQL editor before `db push`.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;
end
$$;
