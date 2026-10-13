import { z } from 'zod';

import { getSupabaseClient } from '@/lib/supabase';

const profileRowsSchema = z.array(z.object({ id: z.string(), display_name: z.string() }));

/** The display names of the members who have chosen one, by user id. */
export async function fetchDisplayNames(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .select('id, display_name')
    .in('id', userIds);
  if (error) throw error;
  return new Map(profileRowsSchema.parse(data).map((row) => [row.id, row.display_name]));
}
