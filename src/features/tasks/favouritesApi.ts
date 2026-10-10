import { z } from 'zod';

import { titleKey } from '@/features/tasks/task';
import { getSupabaseClient } from '@/lib/supabase';

const favouriteRowsSchema = z.array(z.object({ title_key: z.string() }));
/** Postgres' unique_violation: the user has starred the task already. */
const ALREADY_FAVOURITE = '23505';

/**
 * The names of the tasks starred in the user's household, as `titleKey` gives them, each once (members who
 * star the same task each have a row). Stars on other members' private tasks are left out.
 */
export async function fetchFavouriteTasks(): Promise<string[]> {
  const { data, error } = await getSupabaseClient().from('favourite_tasks').select('title_key');
  if (error) throw error;
  return [...new Set(favouriteRowsSchema.parse(data).map((row) => row.title_key))];
}

/**
 * Stars the task with this name for the household, or unstars it whoever starred it. The database fills in
 * the household and who starred it.
 */
export async function setFavouriteTask(title: string, isFavourite: boolean): Promise<void> {
  const favourites = getSupabaseClient().from('favourite_tasks');
  const { error } = isFavourite
    ? await favourites.insert({ title_key: titleKey(title) })
    : await favourites.delete().eq('title_key', titleKey(title));
  if (error && error.code !== ALREADY_FAVOURITE) throw error;
}
