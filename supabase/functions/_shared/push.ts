/**
 * Sending push messages to members' devices (ADR 0005), shared by the Edge Functions. Free of Deno,
 * Supabase and web-push so it can be unit-tested with Vitest; `deno/webPush.ts` supplies the real
 * dependencies.
 */

export interface DeviceSubscription {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** The push message the service worker shows (`src/lib/pushNotification.ts`). */
export interface PushMessage {
  title: string;
  body: string;
  url: string;
}

/**
 * The kinds of notification a member can turn off one by one; each is a column of
 * `notification_preferences`.
 */
export type NotificationKind =
  | 'task_added'
  | 'task_completed'
  | 'task_liked'
  | 'task_commented'
  | 'task_requested'
  | 'request_answered'
  | 'reminder';

/** A push message and the kind it is, so members who turned that kind off are skipped. */
export interface Notification {
  kind: NotificationKind;
  message: PushMessage;
}

export interface PushDependencies {
  /** Those of `userIds` who haven't turned `kind` off; a user who never chose gets every kind. */
  usersWanting: (userIds: string[], kind: NotificationKind) => Promise<string[]>;
  subscriptionsOf: (userIds: string[]) => Promise<DeviceSubscription[]>;
  /** Sends one message; resolves to the push service's HTTP status code (201 on success). */
  send: (subscription: DeviceSubscription, message: PushMessage) => Promise<number>;
  /** Removes a subscription the push service no longer knows. */
  forget: (endpoint: string) => Promise<void>;
}

export interface PushResult {
  sent: number;
  removed: number;
  failed: number;
}

export const nothingSent: PushResult = { sent: 0, removed: 0, failed: 0 };

/** Whether the request carries the shared secret the webhook or cron job is configured with. */
export function isAuthorized(provided: string | null, secret: string | undefined): boolean {
  if (!secret || provided?.length !== secret.length) return false;
  // Compare every character so the time taken doesn't reveal how much of the secret matched.
  let difference = 0;
  for (let i = 0; i < secret.length; i += 1) {
    difference |= provided.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return difference === 0;
}

/** 404 and 410 mean the subscription has expired or was revoked and should be forgotten. */
function isGone(status: number): boolean {
  return status === 404 || status === 410;
}

/**
 * Sends the notification's message to every device of those of `userIds` who want its kind, and
 * forgets devices the push service reports gone.
 */
export async function pushToUsers(
  userIds: string[],
  { kind, message }: Notification,
  deps: PushDependencies,
): Promise<PushResult> {
  const result = { ...nothingSent };
  if (userIds.length === 0) return result;
  const recipients = await deps.usersWanting(userIds, kind);
  if (recipients.length === 0) return result;
  const subscriptions = await deps.subscriptionsOf(recipients);
  await Promise.all(
    subscriptions.map(async (subscription) => {
      const status = await deps.send(subscription, message).catch(() => 0);
      if (status >= 200 && status < 300) {
        result.sent += 1;
      } else if (isGone(status)) {
        // A database hiccup here must not lose the counts of the other devices.
        await deps.forget(subscription.endpoint).then(
          () => (result.removed += 1),
          () => (result.failed += 1),
        );
      } else {
        result.failed += 1;
      }
    }),
  );
  return result;
}
