-- Pictures on tasks (ADR 0004): whoever may edit a task can attach up to three pictures to it, e.g. to show which
-- plants to water. The files are in the private task-images storage bucket, in a folder per household; task_images
-- says which task shows which file, and whoever can see the task can see its pictures.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('task-images', 'task-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create table public.task_images (
  task_id uuid not null references public.tasks (id) on delete cascade,
  -- The file's name in the task-images bucket: '<household id>/<random>.<extension>'.
  path text not null check (char_length(path) <= 200),
  -- Its place among the task's pictures, from 0.
  position smallint not null check (position between 0 and 2),
  primary key (task_id, path)
);
-- A repeating task's next occurrence shows the same files, so a file can be on several tasks.
create index task_images_path_idx on public.task_images (path);

alter table public.task_images enable row level security;

-- Pictures are set only by set_task_images() and complete_task(), and go with their task.
revoke all on table public.task_images from anon, authenticated;
grant select on table public.task_images to authenticated;

create policy "Members can view the pictures of tasks they can see"
  on public.task_images for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_images.task_id));

-- Whether any task shows the file, also one the user can't see. Security definer, so storage policies can tell a
-- file no task needs any more, which may be deleted.
create function private.is_task_image_in_use(file_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.task_images i where i.path = file_path);
$$;
revoke execute on function private.is_task_image_in_use(text) from public;
grant execute on function private.is_task_image_in_use(text) to authenticated;

-- Members upload into their household's folder. They see a file they uploaded, one on a task they can see, and one no
-- task needs any more (so whoever removes a picture can delete its file). Only a file no task needs can be deleted,
-- and files are never replaced.
create policy "Members can upload task pictures to their household's folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'task-images'
    and (storage.foldername(name))[1] = (select private.current_household_id())::text
  );

create policy "Members can view their household's task pictures they may see"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'task-images'
    and (storage.foldername(name))[1] = (select private.current_household_id())::text
    and (
      owner_id = (select auth.uid())::text
      or exists (select 1 from public.task_images i where i.path = objects.name)
      or not private.is_task_image_in_use(name)
    )
  );

create policy "Members can delete their household's task pictures no task needs"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'task-images'
    and (storage.foldername(name))[1] = (select private.current_household_id())::text
    and not private.is_task_image_in_use(name)
  );

-- Sets the pictures of an open task the user may edit (private.can_change_task()), in order, replacing earlier ones;
-- '{}' for none. A picture not yet on the task must be a file the user uploaded to their household's folder. Raises
-- no_data_found (P0002) for a task the user can't edit, check_violation (23514) for more than three pictures or one
-- listed twice, and insufficient_privilege (42501) for a file that isn't the user's upload. The caller then deletes the
-- files of removed pictures that no task needs any more.
create function public.set_task_images(task_id uuid, paths text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  task public.tasks;
begin
  if paths is null then
    raise exception 'List the pictures' using errcode = '22023';
  end if;
  -- The row lock makes a second, simultaneous save wait, so the task never gets more than three pictures.
  select * into task from public.tasks t
    where t.id = set_task_images.task_id
      and private.can_change_task(t)
      and t.completed_at is null
    for update;
  if task.id is null then
    raise exception 'No open task with this id in your household' using errcode = 'P0002';
  end if;
  if cardinality(paths) > 3 then
    raise exception 'A task has at most three pictures' using errcode = '23514';
  end if;
  if (select count(distinct p) from unnest(paths) p) <> cardinality(paths) then
    raise exception 'A picture is listed twice' using errcode = '23514';
  end if;
  if exists (
    select 1 from unnest(paths) p
      where not exists (select 1 from public.task_images i where i.task_id = task.id and i.path = p)
        and not exists (
          select 1 from storage.objects o
            where o.bucket_id = 'task-images'
              and o.name = p
              and o.owner_id = auth.uid()::text
              and (storage.foldername(o.name))[1] = task.household_id::text
        )
  ) then
    raise exception 'Only pictures you uploaded to your household can be added' using errcode = '42501';
  end if;
  delete from public.task_images i where i.task_id = task.id;
  insert into public.task_images (task_id, path, position)
    select task.id, p.path, (p.ordinality - 1)::smallint from unnest(paths) with ordinality as p (path, ordinality);
end;
$$;
revoke execute on function public.set_task_images(uuid, text[]) from public, anon;
grant execute on function public.set_task_images(uuid, text[]) to authenticated;

-- As before (20261011140000_child_permissions.sql), and the next occurrence shows the same pictures.
create or replace function public.complete_task(task_id uuid, completed_on date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  done public.tasks;
  next_id uuid;
begin
  if completed_on is null or completed_on not between current_date - 1 and current_date + 1 then
    raise exception 'A task can only be marked done today' using errcode = '22023';
  end if;
  -- The row lock makes a second, simultaneous completion find the task already done.
  update public.tasks t
    set completed_at = now(), completed_by = auth.uid()
    where t.id = complete_task.task_id
      and private.can_see_task(t)
      and t.completed_at is null
    returning * into done;
  if done.id is null then
    raise exception 'No open task with this id in your household' using errcode = 'P0002';
  end if;
  if done.repeat_every_days is not null then
    insert into public.tasks
      (household_id, title, description, type, points, created_by, repeat_every_days, due_on,
       previous_task_id, is_private, for_children)
    values
      (done.household_id, done.title, done.description, done.type,
       case when private.is_child(done.created_by) then null else done.points end, done.created_by,
       done.repeat_every_days, completed_on + done.repeat_every_days, done.id, done.is_private,
       done.for_children)
    returning id into next_id;
    insert into public.task_images (task_id, path, position)
      select next_id, i.path, i.position from public.task_images i where i.task_id = done.id;
  end if;
  return next_id;
end;
$$;
