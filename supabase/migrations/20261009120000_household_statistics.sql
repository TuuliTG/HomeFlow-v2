-- Statistics (ADR 0006): how many shared tasks each member of the user's household has done and added since a
-- time (all time when null). Counted in the database, so the totals aren't cut short by the API's row limit.
-- Security invoker: Row Level Security limits it to the user's own household, and private tasks never count.
create function public.household_statistics(since timestamptz)
returns table (user_id uuid, done integer, created integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.user_id,
    (
      select count(*)::integer from public.tasks t
      where t.completed_by = m.user_id and not t.is_private
        and t.completed_at >= coalesce(household_statistics.since, '-infinity')
    ),
    (
      select count(*)::integer from public.tasks t
      where t.created_by = m.user_id and not t.is_private
        and t.created_at >= coalesce(household_statistics.since, '-infinity')
    )
  from public.household_members m
  where m.household_id = (select private.current_household_id())
  order by m.joined_at, m.user_id;
$$;
revoke execute on function public.household_statistics(timestamptz) from public, anon;
grant execute on function public.household_statistics(timestamptz) to authenticated;
