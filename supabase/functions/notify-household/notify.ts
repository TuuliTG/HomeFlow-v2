/**
 * What the notify-household Edge Function does (ADR 0005), without Deno, Supabase or web-push, so
 * it can be unit-tested with Vitest. index.ts supplies the real dependencies.
 */
import {
  nothingSent,
  type PushDependencies,
  type PushMessage,
  type PushResult,
  pushToUsers,
} from '../_shared/push.ts';

/** A newly added task, as read from the database. */
export interface TaskAdded {
  householdId: string;
  title: string;
  createdBy: string | null;
  /** Added automatically as the next occurrence of a repeating task, not by a member. */
  isRepeat: boolean;
  /** Seen only by whoever added it, so the family isn't told about it. */
  isPrivate: boolean;
}

export interface NotifyDependencies extends PushDependencies {
  /** The task, read from the database rather than trusted from the webhook payload. */
  taskById: (taskId: string) => Promise<TaskAdded | null>;
  /** User ids of everyone in the household. */
  membersOf: (householdId: string) => Promise<string[]>;
  displayNameOf: (userId: string) => Promise<string | null>;
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

function messageFor(creatorName: string | null, taskTitle: string): PushMessage {
  return { title: 'HomeFlow', body: `${creatorName ?? 'Someone'} added ${taskTitle}`, url: '/' };
}

/**
 * Notifies every household member except whoever added the task, and forgets dead devices. The next
 * occurrence of a repeating task isn't news and a private task isn't the family's, so neither
 * notifies anyone.
 */
export async function notifyHousehold(
  taskId: string,
  deps: NotifyDependencies,
): Promise<PushResult> {
  const task = await deps.taskById(taskId);
  if (!task || task.isRepeat || task.isPrivate) return nothingSent;
  const members = await deps.membersOf(task.householdId);
  const recipients = members.filter((userId) => userId !== task.createdBy);
  if (recipients.length === 0) return nothingSent;

  const creatorName = task.createdBy ? await deps.displayNameOf(task.createdBy) : null;
  return pushToUsers(recipients, messageFor(creatorName, task.title), deps);
}
