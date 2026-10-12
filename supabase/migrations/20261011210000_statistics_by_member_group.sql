-- Statistics by member group (ADR 0006): household_statistics() also returns whether each member is a child, so the
-- Statistics screen can compare only the adults or only the children. The result gains a column, so the function is
-- dropped and recreated, still security definer (see 20261011100000_children.sql) and scoped to the caller's
-- household by current_household_id().
drop function public.household_statistics(timestamptz);

create function public.household_statistics(since timestamptz)
returns table (
  user_id uuid,
  display_name text,
  is_child boolean,
  done integer,
  points integer,
  created integer,
  meta_done integer,
  meta_points integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.user_id,
    p.display_name,
    m.is_child,
    done_tasks.done,
    coalesce(done_tasks.points, 0),
    (
      select count(*)::integer from public.tasks t
      where t.household_id = m.household_id and t.created_by = m.user_id and not t.is_private
        and t.created_at >= coalesce(household_statistics.since, '-infinity')
    ),
    done_tasks.meta_done,
    coalesce(done_tasks.meta_points, 0)
  from public.household_members m
  left join public.profiles p on p.id = m.user_id
  cross join lateral (
    select
      count(*)::integer as done,
      sum(t.points)::integer as points,
      (count(*) filter (where t.type = 'meta'))::integer as meta_done,
      (sum(t.points) filter (where t.type = 'meta'))::integer as meta_points
    from public.tasks t
    where t.household_id = m.household_id and t.completed_by = m.user_id and not t.is_private
      and t.completed_at >= coalesce(household_statistics.since, '-infinity')
  ) done_tasks
  where m.household_id = (select private.current_household_id())
  order by m.joined_at, m.user_id;
$$;
revoke execute on function public.household_statistics(timestamptz) from public, anon;
grant execute on function public.household_statistics(timestamptz) to authenticated;
