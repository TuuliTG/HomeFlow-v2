-- Web Push subscriptions (plan step 3a, ADR 0014): one row per device that turned notifications on.
-- The notify-household Edge Function reads them with the service role to send notifications.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The push service URL for this device; it identifies the subscription.
  endpoint text not null unique check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  -- Keys the browser created for encrypting messages to this device (base64url).
  p256dh text not null check (char_length(p256dh) between 1 and 200),
  auth text not null check (char_length(auth) between 1 and 100),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Users see and remove only their own devices. Saving goes through save_push_subscription(), which
-- can take over an endpoint left by someone who used the same browser before.
revoke all on table public.push_subscriptions from anon, authenticated;
grant select, delete on table public.push_subscriptions to authenticated;

create policy "Users can view their own push subscriptions"
  on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can remove their own push subscriptions"
  on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- Saves this device's subscription for the logged-in user. A browser keeps its endpoint across
-- log-outs, so an endpoint saved by a previous user of the device moves to the current one: the
-- device should only get notifications for whoever is logged in now.
-- Parameters are prefixed so they can't be mistaken for columns or for the auth schema.
create function public.save_push_subscription(push_endpoint text, push_p256dh text, push_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Log in to turn on notifications' using errcode = '42501';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values ((select auth.uid()), push_endpoint, push_p256dh, push_auth)
  on conflict on constraint push_subscriptions_endpoint_key do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        created_at = now();
end;
$$;

revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
