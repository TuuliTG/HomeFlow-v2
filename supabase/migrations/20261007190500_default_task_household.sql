-- New tasks go to the creator's household by default, like created_by defaults to the creator, so the
-- app doesn't have to look the household up first. The insert policy still checks the household.
alter table public.tasks alter column household_id set default private.current_household_id();
