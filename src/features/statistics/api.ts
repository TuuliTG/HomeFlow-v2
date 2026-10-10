import { z } from 'zod';

import type { MemberContribution } from '@/features/statistics/statistics';
import { getSupabaseClient } from '@/lib/supabase';

const statisticsRowsSchema = z.array(
  z.object({
    user_id: z.string(),
    display_name: z.string().nullable(),
    done: z.number(),
    points: z.number(),
    created: z.number(),
    meta_done: z.number(),
    meta_points: z.number(),
  }),
);

/**
 * How many shared tasks each member of the user's household has done (and their points, in all and by
 * task type) and added since `since` (all time when null), in the order they joined. Counted by `household_statistics()`
 * in the database.
 */
export async function fetchContributions(since: Date | null): Promise<MemberContribution[]> {
  // Without generated database types the function's result is untyped; Zod checks it.
  const result = await getSupabaseClient().rpc('household_statistics', {
    since: since?.toISOString() ?? null,
  });
  if (result.error) throw result.error;
  return statisticsRowsSchema
    .parse(result.data)
    .map(({ user_id, display_name, done, points, created, meta_done, meta_points }) => ({
      userId: user_id,
      displayName: display_name,
      done,
      points,
      physicalDone: done - meta_done,
      physicalPoints: points - meta_points,
      metaDone: meta_done,
      metaPoints: meta_points,
      created,
    }));
}
