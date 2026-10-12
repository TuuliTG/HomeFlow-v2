-- Tasks the user helped with (ADR 0004), for their Me page: the newest first, with their share of the points and
-- who did the task. A child helper sees the title of an adults-only task they helped with here, and only here: the
-- task stays hidden from the board and the News, and from other children. A helper's task is never private
-- (set_task_helpers() refuses private tasks), and the user's own household only.
create function public.own_helped_tasks(max_tasks integer)
returns table (
  task_id uuid,
  title text,
  type text,
  points integer,
  completed_at timestamptz,
  completed_by uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.title, t.type, h.points::integer, t.completed_at, t.completed_by
  from public.task_helpers h
  join public.tasks t on t.id = h.task_id
  where h.user_id = auth.uid()
    and t.household_id = (select private.current_household_id())
    and t.completed_at is not null
    and not t.is_private
  order by t.completed_at desc, t.id
  limit least(greatest(own_helped_tasks.max_tasks, 0), 100);
$$;
revoke execute on function public.own_helped_tasks(integer) from public, anon;
grant execute on function public.own_helped_tasks(integer) to authenticated;
