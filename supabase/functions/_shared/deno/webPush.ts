// Deno-only half of _shared/push.ts (ADR 0005): the Supabase service-role client and web-push, for the
// Edge Functions' index.ts files. Type-checked with `deno check`, like them.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import webpush from 'npm:web-push@3.6.7';

import type { DeviceSubscription, PushDependencies, PushMessage } from '../push.ts';

/** Push services that don't answer within this time count as failed for that device. */
const SEND_TIMEOUT_MS = 10_000;
const ONE_DAY_IN_SECONDS = 60 * 60 * 24;

const env = (name: string) => Deno.env.get(name) ?? '';

// The service role bypasses Row Level Security: the functions read every member's devices. It is
// injected by Supabase and never leaves the server.
export const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

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

async function send(subscription: DeviceSubscription, message: PushMessage): Promise<number> {
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

export const pushDependencies: PushDependencies = { subscriptionsOf, send, forget };

// Checked per request so a missing secret shows up as a clear error instead of a function that
// won't start.
export function configureVapid(): boolean {
  const [subject, publicKey, privateKey] = [
    'VAPID_SUBJECT',
    'VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY',
  ].map(env);
  if (!subject || !publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}
