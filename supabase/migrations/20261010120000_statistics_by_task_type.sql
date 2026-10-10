-- Statistics by task type (ADR 0006): household_statistics() also returns how many of the shared tasks each member
-- did were meta work, and the points those earned, so the Statistics screen can show meta and physical points
-- apart. Physical work is the rest. The result gains columns, so the function is dropped and recreated.
drop function public.household_statistics(timestamptz);

create function public.household_statistics(since timestamptz)
returns table (
  user_id uuid,
  display_name text,
  done integer,
  points integer,
  created integer,
  meta_done integer,
  meta_points integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.user_id,
    p.display_name,
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
