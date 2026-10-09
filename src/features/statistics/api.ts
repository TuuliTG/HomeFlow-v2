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
  }),
);

/**
 * How many shared tasks each member of the user's household has done (and their points) and added
 * since `since` (all time when null), in the order they joined. Counted by `household_statistics()`
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
    .map(({ user_id, display_name, done, points, created }) => ({
      userId: user_id,
      displayName: display_name,
      done,
      points,
      created,
    }));
}
