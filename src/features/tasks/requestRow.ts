import { z } from 'zod';

import type { TaskRequest } from '@/features/tasks/task';

/** A task's request as embedded in the tasks select (`task_requests`). */
export const requestRowSchema = z.object({
  requested_by: z.string(),
  requested_for: z.string(),
  answer: z.enum(['accepted', 'declined']).nullable(),
});

/** The request with the names of who asked and who was asked. */
export function taskRequestOf(
  row: z.infer<typeof requestRowSchema>,
  nameOf: (userId: string) => string | null,
): TaskRequest {
  return {
    requestedBy: row.requested_by,
    requesterName: nameOf(row.requested_by),
    requestedFor: row.requested_for,
    askedName: nameOf(row.requested_for),
    answer: row.answer,
  };
}
