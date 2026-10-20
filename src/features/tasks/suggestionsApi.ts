import { z } from 'zod';

import { type TaskSuggestion, taskIconNames, taskTypes } from '@/features/tasks/task';
import { getSupabaseClient } from '@/lib/supabase';

const suggestionRowsSchema = z.array(
  z.object({
    title: z.string(),
    description: z.string().nullable(),
    type: z.enum(taskTypes),
    points: z.number().nullable(),
    repeat_every_days: z.number().nullable(),
    is_private: z.boolean(),
    for_children: z.boolean(),
    /** One this version of the app doesn't know, e.g. added by a newer one, shows as none. */
    icon: z.enum(taskIconNames).nullable().catch(null),
    times_added: z.number(),
    is_open: z.boolean(),
  }),
);

/**
 * The tasks the household has added before, one per title with its newest details, most often added
 * first. Other members' private tasks are left out.
 */
export async function fetchTaskSuggestions(): Promise<TaskSuggestion[]> {
  const result = await getSupabaseClient().rpc('task_suggestions');
  if (result.error) throw result.error;
  return suggestionRowsSchema
    .parse(result.data)
    .map(({ repeat_every_days, is_private, for_children, times_added, is_open, ...task }) => ({
      ...task,
      repeatEveryDays: repeat_every_days,
      isPrivate: is_private,
      forChildren: for_children,
      timesAdded: times_added,
      isOpen: is_open,
    }));
}
