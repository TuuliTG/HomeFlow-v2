/**
 * What the notify-household Edge Function does (ADR 0014), without Deno, Supabase or web-push, so
 * it can be unit-tested with Vitest. index.ts supplies the real dependencies.
 */

/** A newly added task, as read from the database. */
export interface TaskAdded {
  householdId: string;
  title: string;
  createdBy: string | null;
  /** Added automatically as the next occurrence of a repeating task, not by a member. */
  isRepeat: boolean;
}

export interface DeviceSubscription {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** The push message the service worker shows (`src/lib/pushNotification.ts`). */
interface PushMessage {
  title: string;
  body: string;
  url: string;
}

export interface NotifyDependencies {
  /** The task, read from the database rather than trusted from the webhook payload. */
  taskById: (taskId: string) => Promise<TaskAdded | null>;
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

/**
 * The id of the task a Database Webhook payload reports as inserted; null for anything else. Only
 * the id is used: the task itself is read from the database, so a forged payload can't choose the
 * household or the text.
 */
export function parseAddedTaskId(payload: unknown): string | null {
  if (!isRecord(payload) || payload.type !== 'INSERT' || payload.table !== 'tasks') return null;
  const { record } = payload;
  return isRecord(record) && typeof record.id === 'string' ? record.id : null;
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

function messageFor(creatorName: string | null, taskTitle: string): PushMessage {
  return { title: 'HomeFlow', body: `${creatorName ?? 'Someone'} added ${taskTitle}`, url: '/' };
}

/** 404 and 410 mean the subscription has expired or was revoked and should be forgotten. */
function isGone(status: number): boolean {
  return status === 404 || status === 410;
}

/**
 * Notifies every household member except whoever added the task, and forgets dead devices. The next
 * occurrence of a repeating task isn't news, so it notifies no one.
 */
export async function notifyHousehold(
  taskId: string,
  deps: NotifyDependencies,
): Promise<NotifyResult> {
  const result: NotifyResult = { sent: 0, removed: 0, failed: 0 };
  const task = await deps.taskById(taskId);
  if (!task || task.isRepeat) return result;
  const members = await deps.membersOf(task.householdId);
  const recipients = members.filter((userId) => userId !== task.createdBy);
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
