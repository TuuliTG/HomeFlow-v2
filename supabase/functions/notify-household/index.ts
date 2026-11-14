// notify-household Edge Function (ADR 0005): a Database Webhook calls it for each new and changed task; it
// tells the other household members' devices that a shared task was added or done. The logic lives in notify.ts.
import { isAuthorized } from '../_shared/push.ts';
import { displayNameOf, membersOf } from '../_shared/deno/household.ts';
import { reportError } from '../_shared/deno/monitoring.ts';
import {
  configureVapid,
  missingVapidKeys,
  pushDependencies,
  supabase,
} from '../_shared/deno/webPush.ts';
import { type HouseholdTask, notifyHousehold, parseTaskChange } from './notify.ts';

// Supabase's Edge Runtime keeps the function alive for promises handed to waitUntil.
declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

async function taskById(taskId: string): Promise<HouseholdTask | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select(
      'household_id, title, created_by, completed_by, previous_task_id, is_private, for_children, assigned_to',
    )
    .eq('id', taskId)
    .maybeSingle();
  if (error) throw error;
  const row = data as {
    household_id: string;
    title: string;
    created_by: string | null;
    completed_by: string | null;
    previous_task_id: string | null;
    is_private: boolean;
    for_children: boolean;
    assigned_to: string | null;
  } | null;
  return row
    ? {
        householdId: row.household_id,
        title: row.title,
        createdBy: row.created_by,
        completedBy: row.completed_by,
        isRepeat: row.previous_task_id !== null,
        isPrivate: row.is_private,
        forChildren: row.for_children,
        assignedTo: row.assigned_to,
      }
    : null;
}

Deno.serve(async (request) => {
  if (
    !isAuthorized(request.headers.get('x-webhook-secret'), Deno.env.get('NOTIFY_WEBHOOK_SECRET'))
  ) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!configureVapid()) {
    await reportError('notify-household', new Error(missingVapidKeys));
    return new Response('Push notifications are not configured', { status: 500 });
  }
  const change = parseTaskChange(await request.json().catch(() => null));
  if (!change) return Response.json({ skipped: true });

  // Answer the webhook at once; slow push services shouldn't hold up the database's HTTP call.
  EdgeRuntime.waitUntil(
    notifyHousehold(change, { ...pushDependencies, taskById, membersOf, displayNameOf })
      .then((result) => {
        console.log('notify-household', change.kind, change.taskId, JSON.stringify(result));
      })
      .catch((error: unknown) =>
        reportError('notify-household failed', error, { taskId: change.taskId }),
      ),
  );
  return Response.json({ accepted: true }, { status: 202 });
});
