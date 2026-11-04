// notify-praise Edge Function (ADR 0005): a Database Webhook calls it when a member gives a thumbs up to or comments
// on a done task in News; it tells whoever did the task (and earlier commenters). The logic lives in notifyPraise.ts.
import { isAuthorized } from '../_shared/push.ts';
import { displayNameOf, membersOf } from '../_shared/deno/household.ts';
import { reportError } from '../_shared/deno/monitoring.ts';
import {
  configureVapid,
  missingVapidKeys,
  pushDependencies,
  supabase,
} from '../_shared/deno/webPush.ts';
import { notifyPraise, parsePraise, type PraisedTask, type TaskComment } from './notifyPraise.ts';

// Supabase's Edge Runtime keeps the function alive for promises handed to waitUntil.
declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

async function taskById(taskId: string): Promise<PraisedTask | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select('household_id, title, completed_by, is_private, task_helpers(user_id)')
    .eq('id', taskId)
    .maybeSingle();
  if (error) throw error;
  const row = data as {
    household_id: string;
    title: string;
    completed_by: string | null;
    is_private: boolean;
    task_helpers: { user_id: string }[];
  } | null;
  return row
    ? {
        householdId: row.household_id,
        title: row.title,
        completedBy: row.completed_by,
        helpers: row.task_helpers.map((helper) => helper.user_id),
        isPrivate: row.is_private,
      }
    : null;
}

async function likeExists(taskId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('task_likes')
    .select('task_id')
    .eq('task_id', taskId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

async function commentById(commentId: string): Promise<TaskComment | null> {
  const { data, error } = await supabase
    .from('task_comments')
    .select('task_id, author_id, body')
    .eq('id', commentId)
    .maybeSingle();
  if (error) throw error;
  const row = data as { task_id: string; author_id: string | null; body: string } | null;
  return row ? { taskId: row.task_id, authorId: row.author_id, body: row.body } : null;
}

async function commentersOn(taskId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('task_comments')
    .select('author_id')
    .eq('task_id', taskId)
    .not('author_id', 'is', null);
  if (error) throw error;
  return data.map((row: { author_id: string }) => row.author_id);
}

Deno.serve(async (request) => {
  if (
    !isAuthorized(request.headers.get('x-webhook-secret'), Deno.env.get('NOTIFY_WEBHOOK_SECRET'))
  ) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!configureVapid()) {
    await reportError('notify-praise', new Error(missingVapidKeys));
    return new Response('Push notifications are not configured', { status: 500 });
  }
  const praise = parsePraise(await request.json().catch(() => null));
  if (!praise) return Response.json({ skipped: true });
  // Only ids, never what a comment says.
  const described = JSON.stringify(praise);

  // Answer the webhook at once; slow push services shouldn't hold up the database's HTTP call.
  EdgeRuntime.waitUntil(
    notifyPraise(praise, {
      ...pushDependencies,
      taskById,
      likeExists,
      commentById,
      commentersOn,
      membersOf,
      displayNameOf,
    })
      .then((result) => {
        console.log('notify-praise', described, JSON.stringify(result));
      })
      .catch((error: unknown) => reportError('notify-praise failed', error, { praise: described })),
  );
  return Response.json({ accepted: true }, { status: 202 });
});
