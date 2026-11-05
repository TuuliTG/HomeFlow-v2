import { z } from 'zod';

import type { DeviceSubscription } from '@/features/notifications/browserPush';
import {
  allNotifications,
  type NotificationKind,
  type NotificationPreferences,
} from '@/features/notifications/preferences';
import { getSupabaseClient } from '@/lib/supabase';

const columns: Record<NotificationKind, string> = {
  taskAdded: 'task_added',
  taskCompleted: 'task_completed',
  taskLiked: 'task_liked',
  taskCommented: 'task_commented',
  taskRequested: 'task_requested',
  requestAnswered: 'request_answered',
  reminder: 'reminder',
};

const preferencesRowSchema = z
  .object({
    task_added: z.boolean(),
    task_completed: z.boolean(),
    task_liked: z.boolean(),
    task_commented: z.boolean(),
    task_requested: z.boolean(),
    request_answered: z.boolean(),
    reminder: z.boolean(),
  })
  .nullable();

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

/**
 * Which kinds of notification the logged-in user gets on all their devices; Row Level Security
 * shows only their own choices. Everything is on until they choose.
 */
export async function fetchPreferences(): Promise<NotificationPreferences> {
  const { data, error } = await getSupabaseClient()
    .from('notification_preferences')
    .select(Object.values(columns).join(', '))
    .maybeSingle();
  if (error) throw error;
  const row = preferencesRowSchema.parse(data);
  if (!row) return allNotifications;
  return {
    taskAdded: row.task_added,
    taskCompleted: row.task_completed,
    taskLiked: row.task_liked,
    taskCommented: row.task_commented,
    taskRequested: row.task_requested,
    requestAnswered: row.request_answered,
    reminder: row.reminder,
  };
}

/** Turns one kind of notification on or off for the user, keeping their other choices. */
export async function savePreference(
  userId: string,
  kind: NotificationKind,
  wanted: boolean,
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('notification_preferences')
    .upsert({ user_id: userId, [columns[kind]]: wanted, updated_at: new Date().toISOString() });
  if (error) throw error;
}
