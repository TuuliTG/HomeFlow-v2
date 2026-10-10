-- News (ADR 0007): members can give a thumbs up to, and comment on, shared tasks someone in their household has
-- done. Both hang off the task, so the tasks' own Row Level Security decides who sees them: only the household, and
-- never a private task (which can't be liked or commented on anyway).

-- A thumbs up: one per member and task, never on their own work.
create table public.task_likes (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

alter table public.task_likes enable row level security;

revoke all on table public.task_likes from anon, authenticated;
grant select, delete on table public.task_likes to authenticated;
grant insert (task_id) on table public.task_likes to authenticated;

create policy "Members can view likes on tasks they can see"
  on public.task_likes for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_likes.task_id));

create policy "Members can like shared tasks others in their household have done"
  on public.task_likes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.tasks t
      where t.id = task_likes.task_id and t.completed_at is not null and not t.is_private
        and t.completed_by is distinct from (select auth.uid())
    )
  );

create policy "Members can take back their own likes"
  on public.task_likes for delete to authenticated
  using (user_id = (select auth.uid()));

-- A comment on a done shared task, also on one's own (to reply). Comments can't be edited, only deleted by whoever
-- wrote them; they stay when the author leaves, without a name.
create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid default auth.uid() references auth.users (id) on delete set null,
  body text not null check (body = btrim(body) and char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index task_comments_task_id_idx on public.task_comments (task_id);

alter table public.task_comments enable row level security;

revoke all on table public.task_comments from anon, authenticated;
grant select, delete on table public.task_comments to authenticated;
grant insert (task_id, body) on table public.task_comments to authenticated;

create policy "Members can view comments on tasks they can see"
  on public.task_comments for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_comments.task_id));

create policy "Members can comment on shared tasks done in their household"
  on public.task_comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.tasks t
      where t.id = task_comments.task_id and t.completed_at is not null and not t.is_private
    )
  );

create policy "Members can delete their own comments"
  on public.task_comments for delete to authenticated
  using (author_id = (select auth.uid()));
