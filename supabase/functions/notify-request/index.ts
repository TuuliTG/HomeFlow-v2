// notify-request Edge Function (ADR 0005): a Database Webhook calls it when a member asks another to do a task
// and when the request is answered; it notifies the member asked or whoever asked. The logic lives in
// notifyRequest.ts.
import { isAuthorized } from '../_shared/push.ts';
import { reportError } from '../_shared/deno/monitoring.ts';
import {
  configureVapid,
  missingVapidKeys,
  pushDependencies,
  supabase,
} from '../_shared/deno/webPush.ts';
import { notifyRequest, parseRequestChange, type TaskRequest } from './notifyRequest.ts';

// Supabase's Edge Runtime keeps the function alive for promises handed to waitUntil.
declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

async function requestById(requestId: string): Promise<TaskRequest | null> {
  const { data, error } = await supabase
    .from('task_requests')
    .select('requested_by, requested_for, answer, task:tasks(title)')
    .eq('id', requestId)
    .maybeSingle();
  if (error) throw error;
  const row = data as {
    requested_by: string;
    requested_for: string;
    answer: TaskRequest['answer'];
    task: { title: string } | null;
  } | null;
  return row?.task
    ? {
        taskTitle: row.task.title,
        requestedBy: row.requested_by,
        requestedFor: row.requested_for,
        answer: row.answer,
      }
    : null;
}

async function displayNameOf(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as { display_name: string } | null)?.display_name ?? null;
}

Deno.serve(async (request) => {
  if (
    !isAuthorized(request.headers.get('x-webhook-secret'), Deno.env.get('NOTIFY_WEBHOOK_SECRET'))
  ) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!configureVapid()) {
    await reportError('notify-request', new Error(missingVapidKeys));
    return new Response('Push notifications are not configured', { status: 500 });
  }
  const change = parseRequestChange(await request.json().catch(() => null));
  if (!change) return Response.json({ skipped: true });

  // Answer the webhook at once; slow push services shouldn't hold up the database's HTTP call.
  EdgeRuntime.waitUntil(
    notifyRequest(change, { ...pushDependencies, requestById, displayNameOf })
      .then((result) => {
        console.log('notify-request', change.requestId, JSON.stringify(result));
      })
      .catch((error: unknown) =>
        reportError('notify-request failed', error, { requestId: change.requestId }),
      ),
  );
  return Response.json({ accepted: true }, { status: 202 });
});
