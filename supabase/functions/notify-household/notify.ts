/**
 * What the notify-household Edge Function does (ADR 0005), without Deno, Supabase or web-push, so
 * it can be unit-tested with Vitest. index.ts supplies the real dependencies.
 */
import {
  type Notification,
  type NotificationKind,
  nothingSent,
  type PushDependencies,
  type PushResult,
  pushToUsers,
} from '../_shared/push.ts';

/** A task the household is told about, as read from the database. */
export interface HouseholdTask {
  householdId: string;
  title: string;
  createdBy: string | null;
  /** Whoever marked it done; null while it is open. */
  completedBy: string | null;
  /** Added automatically as the next occurrence of a repeating task, not by a member. */
  isRepeat: boolean;
  /** Seen only by whoever added it, so the family isn't told about it. */
  isPrivate: boolean;
  /** Children see only tasks available for them, so they aren't told about the others. */
  forChildren: boolean;
  /** The one child an adult gave it to, if any; the other children don't see it, so they aren't told. */
  assignedTo: string | null;
}

/** What happened to a task: it was added, or marked done. */
export interface TaskChange {
  taskId: string;
  kind: 'added' | 'completed';
}

interface HouseholdMember {
  userId: string;
  isChild: boolean;
}

export interface NotifyDependencies extends PushDependencies {
  /** The task, read from the database rather than trusted from the webhook payload. */
  taskById: (taskId: string) => Promise<HouseholdTask | null>;
  /** Everyone in the household. */
  membersOf: (householdId: string) => Promise<HouseholdMember[]>;
  displayNameOf: (userId: string) => Promise<string | null>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * The task a Database Webhook payload reports as inserted, or as marked done by an update; null for
 * anything else, such as other edits. Only the id is used: the task itself is read from the
 * database, so a forged payload can't choose the household, who is credited or the text.
 */
export function parseTaskChange(payload: unknown): TaskChange | null {
  if (!isRecord(payload) || payload.table !== 'tasks') return null;
  const { record, old_record: oldRecord } = payload;
  if (!isRecord(record) || typeof record.id !== 'string') return null;
  if (payload.type === 'INSERT') return { taskId: record.id, kind: 'added' };
  const justDone =
    payload.type === 'UPDATE' &&
    isRecord(oldRecord) &&
    oldRecord.completed_at === null &&
    typeof record.completed_at === 'string';
  return justDone ? { taskId: record.id, kind: 'completed' } : null;
}

function notification(kind: NotificationKind, body: string, url: string): Notification {
  return { kind, message: { title: 'HomeFlow', body, url } };
}

/** Whether the member sees the task, like `private.can_see_task()` for a shared task in their household. */
function canSee({ userId, isChild }: HouseholdMember, task: HouseholdTask): boolean {
  return !isChild || (task.forChildren && (task.assignedTo === null || task.assignedTo === userId));
}

/**
 * Tells the household about a shared task: when it was added, every member who can see it except
 * whoever added it (opening the board); when it was done, the other adults (opening News, to
 * praise it; children have no News, ADR 0008). The next occurrence of a repeating task isn't news
 * and a private task isn't the family's, so neither notifies anyone, nor does a task undone before
 * the webhook arrived. Members who turned that kind off are skipped, and dead devices are forgotten.
 */
export async function notifyHousehold(
  { taskId, kind }: TaskChange,
  deps: NotifyDependencies,
): Promise<PushResult> {
  const task = await deps.taskById(taskId);
  if (!task || task.isPrivate) return nothingSent;
  if (kind === 'added' ? task.isRepeat : task.completedBy === null) return nothingSent;
  const actor = kind === 'added' ? task.createdBy : task.completedBy;
  const members = await deps.membersOf(task.householdId);
  const recipients = members
    .filter(
      (member) =>
        member.userId !== actor && canSee(member, task) && (kind === 'added' || !member.isChild),
    )
    .map(({ userId }) => userId);
  if (recipients.length === 0) return nothingSent;

  const name = (actor ? await deps.displayNameOf(actor) : null) ?? 'Someone';
  return pushToUsers(
    recipients,
    kind === 'added'
      ? notification('task_added', `${name} added ${task.title}`, '/')
      : notification('task_completed', `${name} did ${task.title}`, '/news'),
    deps,
  );
}
