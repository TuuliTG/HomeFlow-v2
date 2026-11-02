import { z } from 'zod';

import { getSupabaseClient } from '@/lib/supabase';

const labelRowsSchema = z.array(z.object({ label: z.string() }));

/**
 * The household's own task labels, each once ignoring case, most used first (`custom_task_labels()`). Labels only
 * other members' private tasks have are left out.
 */
export async function fetchCustomTaskLabels(): Promise<string[]> {
  const result = await getSupabaseClient().rpc('custom_task_labels');
  if (result.error) throw result.error;
  return labelRowsSchema.parse(result.data).map((row) => row.label);
}
