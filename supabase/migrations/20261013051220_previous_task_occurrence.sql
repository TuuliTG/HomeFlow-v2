-- The occurrence a repeating task repeats (ADR 0004), so task cards can say who last did it. PostgREST finds no
-- relationship for the self-referencing, unique previous_task_id, so this computed relationship lets the app embed
-- it: `previous_occurrence(completed_by, completed_at)`. Security invoker: RLS shows it only to whoever can see it.
create function public.previous_occurrence(public.tasks)
returns setof public.tasks
rows 1
language sql
stable
set search_path = ''
as $$
  select * from public.tasks where id = $1.previous_task_id;
$$;
revoke execute on function public.previous_occurrence(public.tasks) from public, anon;
grant execute on function public.previous_occurrence(public.tasks) to authenticated;
