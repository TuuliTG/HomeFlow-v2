-- A reaction in News can be one of a few emoji, not only a thumbs up (ADR 0008). Each member still reacts once to a
-- task (`task_likes`' primary key) and can change their emoji. Existing likes stay thumbs up. The emoji are the same
-- as `reactions` in src/features/news/news.ts.
alter table public.task_likes
  add column emoji text not null default '👍'
    check (emoji in ('👍', '❤️', '👏', '🎉', '💪', '😂'));

grant insert (emoji), update (emoji) on table public.task_likes to authenticated;

-- Changing the emoji keeps the like a member's own, on a task they could like.
create policy "Members can change the emoji of their own likes"
  on public.task_likes for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
