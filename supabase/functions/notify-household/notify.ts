/**
 * What the notify-household Edge Function does (ADR 0014), without Deno, Supabase or web-push, so
 * it can be unit-tested with Vitest. index.ts supplies the real dependencies.
 */

/** A new task, as delivered by the Database Webhook on `public.tasks` inserts. */
export interface TaskAdded {
  householdId: string;
  title: string;
  createdBy: string | null;
}

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

export interface NotifyDependencies {
  /** User ids of everyone in the household. */
  membersOf: (householdId: string) => Promise<string[]>;
  displayNameOf: (userId: string) => Promise<string | null>;
  subscriptionsOf: (userIds: string[]) => Promise<DeviceSubscription[]>;
  /** Sends one message; resolves to the push service's HTTP status code (201 on success). */
  send: (subscription: DeviceSubscription, message: PushMessage) => Promise<number>;
  /** Removes a subscription the push service no longer knows. */
  forget: (endpoint: string) => Promise<void>;
}

export interface NotifyResult {
  sent: number;
  removed: number;
  failed: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Reads a Database Webhook payload; null for anything but a task insert. */
export function parseTaskAdded(payload: unknown): TaskAdded | null {
  if (!isRecord(payload) || payload.type !== 'INSERT' || payload.table !== 'tasks') return null;
  const { record } = payload;
  if (!isRecord(record)) return null;
  const { household_id: householdId, title, created_by: createdBy } = record;
  if (typeof householdId !== 'string' || typeof title !== 'string') return null;
  return {
    householdId,
    title,
    createdBy: typeof createdBy === 'string' ? createdBy : null,
  };
}

/** Whether the request carries the shared secret the webhook is configured with. */
export function isAuthorized(provided: string | null, secret: string | undefined): boolean {
  if (!secret || provided?.length !== secret.length) return false;
  // Compare every character so the time taken doesn't reveal how much of the secret matched.
  let difference = 0;
  for (let i = 0; i < secret.length; i += 1) {
    difference |= provided.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return difference === 0;
}

export function messageFor(creatorName: string | null, taskTitle: string): PushMessage {
  return { title: 'HomeFlow', body: `${creatorName ?? 'Someone'} added ${taskTitle}`, url: '/' };
}

/** 404 and 410 mean the subscription has expired or was revoked and should be forgotten. */
export function isGone(status: number): boolean {
  return status === 404 || status === 410;
}

/** Notifies every household member except whoever added the task, and forgets dead devices. */
export async function notifyHousehold(
  task: TaskAdded,
  deps: NotifyDependencies,
): Promise<NotifyResult> {
  const members = await deps.membersOf(task.householdId);
  const recipients = members.filter((userId) => userId !== task.createdBy);
  const result: NotifyResult = { sent: 0, removed: 0, failed: 0 };
  if (recipients.length === 0) return result;

  const [subscriptions, creatorName] = await Promise.all([
    deps.subscriptionsOf(recipients),
    task.createdBy ? deps.displayNameOf(task.createdBy) : Promise.resolve(null),
  ]);
  const message = messageFor(creatorName, task.title);

  await Promise.all(
    subscriptions.map(async (subscription) => {
      const status = await deps.send(subscription, message).catch(() => 0);
      if (status >= 200 && status < 300) {
        result.sent += 1;
      } else if (isGone(status)) {
        await deps.forget(subscription.endpoint);
        result.removed += 1;
      } else {
        result.failed += 1;
      }
    }),
  );
  return result;
}
