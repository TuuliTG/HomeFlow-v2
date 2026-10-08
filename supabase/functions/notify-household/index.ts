// notify-household Edge Function (ADR 0005): a Database Webhook calls it for each new task; it sends
// a push notification to the other household members' devices. The logic lives in notify.ts.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import webpush from 'npm:web-push@3.6.7';

import {
  type DeviceSubscription,
  isAuthorized,
  notifyHousehold,
  parseAddedTaskId,
  type TaskAdded,
} from './notify.ts';

// Supabase's Edge Runtime keeps the function alive for promises handed to waitUntil.
declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

/** Push services that don't answer within this time count as failed for that device. */
const SEND_TIMEOUT_MS = 10_000;
const ONE_DAY_IN_SECONDS = 60 * 60 * 24;

const env = (name: string) => Deno.env.get(name) ?? '';

// The service role bypasses Row Level Security: this function reads every member's devices. It is
// injected by Supabase and never leaves the server.
const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

async function taskById(taskId: string): Promise<TaskAdded | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select('household_id, title, created_by, previous_task_id')
    .eq('id', taskId)
    .maybeSingle();
  if (error) throw error;
  const row = data as {
    household_id: string;
    title: string;
    created_by: string | null;
    previous_task_id: string | null;
  } | null;
  return row
    ? {
        householdId: row.household_id,
        title: row.title,
        createdBy: row.created_by,
        isRepeat: row.previous_task_id !== null,
      }
    : null;
}

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
      { TTL: ONE_DAY_IN_SECONDS, timeout: SEND_TIMEOUT_MS },
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

// Checked per request so a missing secret shows up as a clear error instead of a function that
// won't start.
function configureVapid(): boolean {
  const [subject, publicKey, privateKey] = [
    'VAPID_SUBJECT',
    'VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY',
  ].map(env);
  if (!subject || !publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

Deno.serve(async (request) => {
  if (
    !isAuthorized(request.headers.get('x-webhook-secret'), Deno.env.get('NOTIFY_WEBHOOK_SECRET'))
  ) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!configureVapid()) {
    console.error('notify-household: set VAPID_SUBJECT, VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY');
    return new Response('Push notifications are not configured', { status: 500 });
  }
  const taskId = parseAddedTaskId(await request.json().catch(() => null));
  if (!taskId) return Response.json({ skipped: true });

  // Answer the webhook at once; slow push services shouldn't hold up the database's HTTP call.
  EdgeRuntime.waitUntil(
    notifyHousehold(taskId, { taskById, membersOf, displayNameOf, subscriptionsOf, send, forget })
      .then((result) => {
        console.log('notify-household', taskId, JSON.stringify(result));
      })
      .catch((error: unknown) => {
        console.error('notify-household failed', taskId, error);
      }),
  );
  return Response.json({ accepted: true }, { status: 202 });
});
