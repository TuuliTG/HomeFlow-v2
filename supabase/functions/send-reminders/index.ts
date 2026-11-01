// send-reminders Edge Function (ADR 0004, ADR 0005): Supabase Cron calls it every minute; it sends
// each reminder that has come due to its user's devices. The logic lives in remind.ts.
import { isAuthorized } from '../_shared/push.ts';
import { reportError } from '../_shared/deno/monitoring.ts';
import {
  configureVapid,
  missingVapidKeys,
  pushDependencies,
  supabase,
} from '../_shared/deno/webPush.ts';
import { type DueReminder, sendDueReminders } from './remind.ts';

async function takeDueReminders(): Promise<DueReminder[]> {
  const { data, error } = await supabase.rpc('take_due_reminders');
  if (error) throw error;
  return (data as { user_id: string; task_title: string }[]).map((row) => ({
    userId: row.user_id,
    taskTitle: row.task_title,
  }));
}

Deno.serve(async (request) => {
  if (
    !isAuthorized(request.headers.get('x-webhook-secret'), Deno.env.get('NOTIFY_WEBHOOK_SECRET'))
  ) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!configureVapid()) {
    await reportError('send-reminders', new Error(missingVapidKeys));
    return new Response('Push notifications are not configured', { status: 500 });
  }
  // Waited for, unlike notify-household: the cron job has nothing else to do, and a run that takes
  // longer than a minute simply overlaps the next one, which finds nothing left to send.
  try {
    const result = await sendDueReminders({ ...pushDependencies, takeDueReminders, reportError });
    console.log('send-reminders', JSON.stringify(result));
    return Response.json(result);
  } catch (error) {
    await reportError('send-reminders failed', error);
    return new Response('Sending reminders failed', { status: 500 });
  }
});
