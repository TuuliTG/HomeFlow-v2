-- The Edge Functions (ADR 0005) read and clean up with the service role. Projects that don't expose new tables to the
-- Data API roles automatically (config.toml: auto_expose_new_tables = false) give it no table privileges, so grant
-- exactly what the functions use: notify-household reads the new task, the household's members and the creator's
-- name; both functions read members' devices and forget the ones the push service reports gone.
grant select on table public.tasks, public.household_members, public.profiles to service_role;
grant select, delete on table public.push_subscriptions to service_role;
