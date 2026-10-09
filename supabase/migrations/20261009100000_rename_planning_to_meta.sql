-- Planning work is called meta work (ADR 0004): the task type 'planning' becomes 'meta'.
alter table public.tasks drop constraint tasks_type_check;
update public.tasks set type = 'meta' where type = 'planning';
alter table public.tasks add constraint tasks_type_check check (type in ('physical', 'meta'));
