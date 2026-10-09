import { z } from 'zod';

import type { MemberContribution } from '@/features/statistics/statistics';
import { getSupabaseClient } from '@/lib/supabase';

const statisticsRowsSchema = z.array(
  z.object({ user_id: z.string(), done: z.number(), created: z.number() }),
);
const profileRowsSchema = z.array(z.object({ id: z.string(), display_name: z.string() }));

/**
 * How many shared tasks each member of the user's household has done and added since `since` (all
 * time when null), in the order they joined. Counted by `household_statistics()` in the database.
 */
export async function fetchContributions(since: Date | null): Promise<MemberContribution[]> {
  const client = getSupabaseClient();
  const statistics = await client.rpc('household_statistics', {
    since: since?.toISOString() ?? null,
  });
  if (statistics.error) throw statistics.error;
  const rows = statisticsRowsSchema.parse(statistics.data);

  const profiles = await client
    .from('profiles')
    .select('id, display_name')
    .in(
      'id',
      rows.map((row) => row.user_id),
    );
  if (profiles.error) throw profiles.error;
  const names = new Map(
    profileRowsSchema.parse(profiles.data).map((row) => [row.id, row.display_name]),
  );
  return rows.map(({ user_id, done, created }) => ({
    userId: user_id,
    displayName: names.get(user_id) ?? null,
    done,
    created,
  }));
}
