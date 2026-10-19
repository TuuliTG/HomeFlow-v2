import { getSupabaseClient } from '@/lib/supabase';

/**
 * Asks another member of the household to do an open shared task that is free or the user's, replacing
 * any earlier request for it (`request_task()`). They are notified and accept or decline.
 */
export async function requestTask(taskId: string, memberId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('request_task', {
    task_id: taskId,
    member_id: memberId,
  });
  if (error) throw error;
}

/** Accepts a request to do a task, which picks it up for the user, or declines it. */
export async function answerTaskRequest(taskId: string, accept: boolean): Promise<void> {
  const { error } = await getSupabaseClient().rpc('answer_task_request', {
    task_id: taskId,
    accept,
  });
  if (error) throw error;
}

/** Withdraws the user's request that hasn't been accepted, or clears one that was declined. */
export async function cancelTaskRequest(taskId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('cancel_task_request', { task_id: taskId });
  if (error) throw error;
}
