// notify-household Edge Function (ADR 0014): a Database Webhook calls it for each new task; it sends
// a push notification to the other household members' devices. The logic lives in notify.ts.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import webpush from 'npm:web-push@3.6.7';

import {
  type DeviceSubscription,
  isAuthorized,
  notifyHousehold,
  parseTaskAdded,
} from './notify.ts';

const env = (name: string) => Deno.env.get(name) ?? '';

webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));

// The service role bypasses Row Level Security: this function reads every member's devices. It is
// injected by Supabase and never leaves the server.
const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

async function membersOf(householdId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId);
  if (error) throw error;
  return data.map((row: { user_id: string }) => row.user_id);
}

async function displayNameOf(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as { display_name: string } | null)?.display_name ?? null;
}

async function subscriptionsOf(userIds: string[]): Promise<DeviceSubscription[]> {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .in('user_id', userIds);
  if (error) throw error;
  return data.map((row: { user_id: string; endpoint: string; p256dh: string; auth: string }) => ({
    userId: row.user_id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
  }));
}

async function send(subscription: DeviceSubscription, message: unknown): Promise<number> {
  try {
    const response = await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(message),
      { TTL: 60 * 60 * 24 },
    );
    return response.statusCode;
  } catch (error) {
    // web-push rejects with the push service's status code on any non-2xx answer.
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    return typeof statusCode === 'number' ? statusCode : 0;
  }
}

async function forget(endpoint: string): Promise<void> {
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) throw error;
}

Deno.serve(async (request) => {
  if (
    !isAuthorized(request.headers.get('x-webhook-secret'), Deno.env.get('NOTIFY_WEBHOOK_SECRET'))
  ) {
    return new Response('Unauthorized', { status: 401 });
  }
  const task = parseTaskAdded(await request.json().catch(() => null));
  if (!task) return Response.json({ skipped: true });

  const result = await notifyHousehold(task, {
    membersOf,
    displayNameOf,
    subscriptionsOf,
    send,
    forget,
  });
  return Response.json(result);
});
