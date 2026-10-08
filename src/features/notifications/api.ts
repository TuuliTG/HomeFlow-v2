import type { DeviceSubscription } from '@/features/notifications/browserPush';
import { getSupabaseClient } from '@/lib/supabase';

/** Saves this device's subscription for the logged-in user (ADR 0005). */
export async function saveSubscription(subscription: DeviceSubscription): Promise<void> {
  const { error } = await getSupabaseClient().rpc('save_push_subscription', {
    push_endpoint: subscription.endpoint,
    push_p256dh: subscription.p256dh,
    push_auth: subscription.auth,
  });
  if (error) throw error;
}

/** Forgets a device; Row Level Security limits this to the user's own devices. */
export async function deleteSubscription(endpoint: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint);
  if (error) throw error;
}
