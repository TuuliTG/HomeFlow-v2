import { z } from 'zod';

import { getSupabaseClient } from '@/lib/supabase';

const newTaskRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  created_by: z.string().nullable(),
  previous_task_id: z.string().nullable(),
});

/** A change to the household's tasks, as delivered live. */
export type TaskChange =
  | {
      kind: 'added';
      id: string;
      title: string;
      createdBy: string | null;
      /** Added automatically as the next occurrence of a repeating task that was just done. */
      isRepeat: boolean;
    }
  /** A task was changed or deleted. */
  | { kind: 'changed' };

/**
 * Calls `onChange` for each task added to, changed in or deleted from the household while subscribed
 * (Supabase Realtime, which applies Row Level Security per subscriber except to deletes). Returns an
 * unsubscribe function.
 */
export function subscribeToTaskChanges(onChange: (change: TaskChange) => void): () => void {
  const client = getSupabaseClient();
  // A unique topic per subscription: a channel that is still leaving would otherwise be reused.
  const channel = client
    .channel(`household-tasks:${crypto.randomUUID()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, (payload) => {
      const row = newTaskRowSchema.safeParse(payload.new);
      if (row.success) {
        onChange({
          kind: 'added',
          id: row.data.id,
          title: row.data.title,
          createdBy: row.data.created_by,
          isRepeat: row.data.previous_task_id !== null,
        });
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, () => {
      onChange({ kind: 'changed' });
    })
    // Realtime can't apply Row Level Security to deletes, so these come from every household and
    // carry only the id. They only trigger a refetch, which RLS does scope.
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' }, () => {
      onChange({ kind: 'changed' });
    })
    .subscribe((status, error) => {
      if ((['CHANNEL_ERROR', 'TIMED_OUT'] as string[]).includes(status)) {
        console.warn('Live task updates are unavailable', status, error);
      }
    });
  return () => {
    void client.removeChannel(channel);
  };
}
