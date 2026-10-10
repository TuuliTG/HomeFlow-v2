import { z } from 'zod';

import { titleKey } from '@/features/tasks/task';
import { getSupabaseClient } from '@/lib/supabase';

const favouriteRowsSchema = z.array(z.object({ title_key: z.string() }));
/** Postgres' unique_violation: the task is a favourite already. */
const ALREADY_FAVOURITE = '23505';

/** The names of the tasks the user has starred in their household, as `titleKey` gives them. */
export async function fetchFavouriteTasks(): Promise<string[]> {
  const { data, error } = await getSupabaseClient().from('favourite_tasks').select('title_key');
  if (error) throw error;
  return favouriteRowsSchema.parse(data).map((row) => row.title_key);
}

/** Stars or unstars the task with this name for the user; the database fills in the user and household. */
export async function setFavouriteTask(title: string, isFavourite: boolean): Promise<void> {
  const favourites = getSupabaseClient().from('favourite_tasks');
  const { error } = isFavourite
    ? await favourites.insert({ title_key: titleKey(title) })
    : await favourites.delete().eq('title_key', titleKey(title));
  if (error && error.code !== ALREADY_FAVOURITE) throw error;
}
