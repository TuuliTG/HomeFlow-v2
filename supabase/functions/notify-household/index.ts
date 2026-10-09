// notify-household Edge Function (ADR 0005): a Database Webhook calls it for each new task; it sends
// a push notification to the other household members' devices. The logic lives in notify.ts.
import { isAuthorized } from '../_shared/push.ts';
import { configureVapid, pushDependencies, supabase } from '../_shared/deno/webPush.ts';
import { notifyHousehold, parseAddedTaskId, type TaskAdded } from './notify.ts';

// Supabase's Edge Runtime keeps the function alive for promises handed to waitUntil.
declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

async function taskById(taskId: string): Promise<TaskAdded | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select('household_id, title, created_by, previous_task_id, is_private')
    .eq('id', taskId)
    .maybeSingle();
  if (error) throw error;
  const row = data as {
    household_id: string;
    title: string;
    created_by: string | null;
    previous_task_id: string | null;
    is_private: boolean;
  } | null;
  return row
    ? {
        householdId: row.household_id,
        title: row.title,
        createdBy: row.created_by,
        isRepeat: row.previous_task_id !== null,
        isPrivate: row.is_private,
      }
    : null;
}

async function membersOf(householdId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId);
  if (error) throw error;
  return data.map((row: { user_id: string }) => row.user_id);
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
    console.error('notify-household: set VAPID_SUBJECT, VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY');
    return new Response('Push notifications are not configured', { status: 500 });
  }
  const taskId = parseAddedTaskId(await request.json().catch(() => null));
  if (!taskId) return Response.json({ skipped: true });

  // Answer the webhook at once; slow push services shouldn't hold up the database's HTTP call.
  EdgeRuntime.waitUntil(
    notifyHousehold(taskId, { ...pushDependencies, taskById, membersOf, displayNameOf })
      .then((result) => {
        console.log('notify-household', taskId, JSON.stringify(result));
      })
      .catch((error: unknown) => {
        console.error('notify-household failed', taskId, error);
      }),
  );
  return Response.json({ accepted: true }, { status: 202 });
});
