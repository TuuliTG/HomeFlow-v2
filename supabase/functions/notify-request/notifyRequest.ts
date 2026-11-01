/**
 * What the notify-request Edge Function does (ADR 0005), without Deno, Supabase or web-push, so it
 * can be unit-tested with Vitest. index.ts supplies the real dependencies.
 */
import {
  nothingSent,
  type PushDependencies,
  type PushMessage,
  type PushResult,
  pushToUsers,
} from '../_shared/push.ts';

/** A member's request that another do a task (`task_requests`), as read from the database. */
export interface TaskRequest {
  taskTitle: string;
  requestedBy: string;
  requestedFor: string;
  /** Null while waiting for an answer. */
  answer: 'accepted' | 'declined' | null;
}

/** What happened to a request: it was made, or the member asked answered it. */
export interface RequestChange {
  requestId: string;
  kind: 'asked' | 'answered';
}

export interface NotifyRequestDependencies extends PushDependencies {
  /** The request, read from the database rather than trusted from the webhook payload. */
  requestById: (requestId: string) => Promise<TaskRequest | null>;
  displayNameOf: (userId: string) => Promise<string | null>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * The request a Database Webhook payload reports as made (insert) or answered (update); null for
 * anything else. Only the id is used: the request itself is read from the database, so a forged
 * payload can't choose who is notified or the text.
 */
export function parseRequestChange(payload: unknown): RequestChange | null {
  if (!isRecord(payload) || payload.table !== 'task_requests') return null;
  if (payload.type !== 'INSERT' && payload.type !== 'UPDATE') return null;
  const { record } = payload;
  if (!isRecord(record) || typeof record.id !== 'string') return null;
  return { requestId: record.id, kind: payload.type === 'INSERT' ? 'asked' : 'answered' };
}

function message(body: string, url: string): PushMessage {
  return { title: 'HomeFlow', body, url };
}

/**
 * Tells the member asked who asks them to do which task, opening their tasks to answer; or tells
 * whoever asked how the member answered, opening the board. A request answered or replaced before
 * the webhook arrives sends nothing out of turn.
 */
export async function notifyRequest(
  { requestId, kind }: RequestChange,
  deps: NotifyRequestDependencies,
): Promise<PushResult> {
  const request = await deps.requestById(requestId);
  if (!request) return nothingSent;
  if (kind === 'asked') {
    if (request.answer !== null) return nothingSent;
    const name = (await deps.displayNameOf(request.requestedBy)) ?? 'Someone';
    return pushToUsers(
      [request.requestedFor],
      message(`${name} asks you to do ${request.taskTitle}`, '/me'),
      deps,
    );
  }
  if (request.answer === null) return nothingSent;
  const name = (await deps.displayNameOf(request.requestedFor)) ?? 'Someone';
  const body =
    request.answer === 'accepted'
      ? `${name} will do ${request.taskTitle}`
      : `${name} can't do ${request.taskTitle}`;
  return pushToUsers([request.requestedBy], message(body, '/'), deps);
}
