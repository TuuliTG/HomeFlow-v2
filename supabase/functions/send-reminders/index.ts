// send-reminders Edge Function (ADR 0004, ADR 0005): Supabase Cron calls it every minute; it sends
// each reminder that has come due to its user's devices. The logic lives in remind.ts.
import { isAuthorized } from '../_shared/push.ts';
import { configureVapid, pushDependencies, supabase } from '../_shared/deno/webPush.ts';
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
    console.error('send-reminders: set VAPID_SUBJECT, VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY');
    return new Response('Push notifications are not configured', { status: 500 });
  }
  // Waited for, unlike notify-household: the cron job has nothing else to do, and a run that takes
  // longer than a minute simply overlaps the next one, which finds nothing left to send.
  try {
    const result = await sendDueReminders({ ...pushDependencies, takeDueReminders });
    console.log('send-reminders', JSON.stringify(result));
    return Response.json(result);
  } catch (error) {
    console.error('send-reminders failed', error);
    return new Response('Sending reminders failed', { status: 500 });
  }
});
