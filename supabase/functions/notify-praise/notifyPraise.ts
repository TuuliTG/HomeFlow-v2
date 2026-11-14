/**
 * What the notify-praise Edge Function does (ADR 0005, ADR 0008), without Deno, Supabase or
 * web-push, so it can be unit-tested with Vitest. index.ts supplies the real dependencies.
 */
import {
  type Notification,
  type NotificationKind,
  nothingSent,
  type PushDependencies,
  type PushResult,
  pushToUsers,
} from '../_shared/push.ts';

/** A done task in News that someone praised, as read from the database. */
export interface PraisedTask {
  householdId: string;
  title: string;
  /** Whoever marked it done; null if it was undone. */
  completedBy: string | null;
  /** Members who helped and share its points (ADR 0004). */
  helpers: string[];
  isPrivate: boolean;
}

/** A comment on a done task (`task_comments`), as read from the database. */
export interface TaskComment {
  taskId: string;
  /** Null once the author's account is deleted. */
  authorId: string | null;
  body: string;
}

/** A thumbs up or a comment that was just added. */
export type Praise =
  { kind: 'liked'; taskId: string; likedBy: string } | { kind: 'commented'; commentId: string };

interface HouseholdMember {
  userId: string;
  isChild: boolean;
}

export interface NotifyPraiseDependencies extends PushDependencies {
  /** The task, read from the database rather than trusted from the webhook payload. */
  taskById: (taskId: string) => Promise<PraisedTask | null>;
  /** Whether the thumbs up is still there, i.e. wasn't taken back before the webhook arrived. */
  likeExists: (taskId: string, userId: string) => Promise<boolean>;
  commentById: (commentId: string) => Promise<TaskComment | null>;
  /** Everyone who has commented on the task, including the new comment's author. */
  commentersOn: (taskId: string) => Promise<string[]>;
  membersOf: (householdId: string) => Promise<HouseholdMember[]>;
  displayNameOf: (userId: string) => Promise<string | null>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * The thumbs up or comment a Database Webhook payload reports as inserted; null for anything else.
 * Only the keys are used: the like, comment and task are read from the database, so a forged
 * payload can't choose who is notified or the text.
 */
export function parsePraise(payload: unknown): Praise | null {
  if (!isRecord(payload) || payload.type !== 'INSERT' || !isRecord(payload.record)) return null;
  const { record } = payload;
  if (payload.table === 'task_likes') {
    return typeof record.task_id === 'string' && typeof record.user_id === 'string'
      ? { kind: 'liked', taskId: record.task_id, likedBy: record.user_id }
      : null;
  }
  if (payload.table === 'task_comments') {
    return typeof record.id === 'string' ? { kind: 'commented', commentId: record.id } : null;
  }
  return null;
}

/** Comments can be 500 characters; the notification shows the start (push bodies are ≤ 300). */
const EXCERPT_LENGTH = 100;

/** Cuts text to at most `max` characters, never inside an emoji, marking the cut with "…". */
function excerpt(text: string, max: number): string {
  const characters = Array.from(text);
  return characters.length <= max ? text : `${characters.slice(0, max - 1).join('')}…`;
}

function notification(kind: NotificationKind, body: string): Notification {
  return { kind, message: { title: 'HomeFlow', body, url: '/news' } };
}

/** Who the praise is for, and what to tell them; null when it should send nothing. */
interface Delivery {
  task: PraisedTask;
  actor: string | null;
  /** Members to tell besides those who did the task. */
  others: string[];
  message: (name: string, title: string) => Notification;
}

async function deliveryFor(praise: Praise, deps: NotifyPraiseDependencies) {
  if (praise.kind === 'liked') {
    const { taskId, likedBy } = praise;
    const [task, stillLiked] = await Promise.all([
      deps.taskById(taskId),
      deps.likeExists(taskId, likedBy),
    ]);
    if (!task || !stillLiked) return null;
    return {
      task,
      actor: likedBy,
      others: [],
      message: (name, title) =>
        notification('task_liked', `${name} gave you a thumbs up for ${title}`),
    } satisfies Delivery;
  }
  const comment = await deps.commentById(praise.commentId);
  if (!comment) return null;
  const [task, commenters] = await Promise.all([
    deps.taskById(comment.taskId),
    deps.commentersOn(comment.taskId),
  ]);
  if (!task) return null;
  const text = excerpt(comment.body, EXCERPT_LENGTH);
  return {
    task,
    actor: comment.authorId,
    others: commenters,
    message: (name, title) =>
      notification('task_commented', `${name} commented on ${title}: ${text}`),
  } satisfies Delivery;
}

/**
 * Tells whoever did a task, and its helpers, that someone gave it a thumbs up or commented on it;
 * a comment also reaches those who commented before, so replies are heard. Everyone opens News. The
 * member who praised isn't told, nor are children (they have no News, ADR 0008) or anyone no longer
 * in the household. A thumbs up taken back, a comment deleted, or a task undone or made private
 * before the webhook arrived sends nothing. Members who turned that kind off are skipped.
 */
export async function notifyPraise(
  praise: Praise,
  deps: NotifyPraiseDependencies,
): Promise<PushResult> {
  const delivery = await deliveryFor(praise, deps);
  if (!delivery) return nothingSent;
  const { task, actor, others, message } = delivery;
  if (task.isPrivate || task.completedBy === null) return nothingSent;

  const adults = new Set(
    (await deps.membersOf(task.householdId))
      .filter((member) => !member.isChild)
      .map(({ userId }) => userId),
  );
  const recipients = [...new Set([task.completedBy, ...task.helpers, ...others])].filter(
    (userId) => userId !== actor && adults.has(userId),
  );
  if (recipients.length === 0) return nothingSent;

  const name = (actor ? await deps.displayNameOf(actor) : null) ?? 'Someone';
  return pushToUsers(recipients, message(name, task.title), deps);
}
