import { z } from 'zod';

import { IMAGE_URL_LIFETIME_SECONDS } from '@/features/tasks/task';
import { getSupabaseClient } from '@/lib/supabase';

/** The private storage bucket of task pictures, a folder per household (ADR 0004). */
const BUCKET = 'task-images';

/**
 * Uploads a picture (a JPEG from `shrinkImage`) to the household's folder and returns its file name, to
 * attach with `setTaskImages`. Until then only the user can see it.
 */
export async function uploadTaskImage(householdId: string, image: Blob): Promise<string> {
  const path = `${householdId}/${crypto.randomUUID()}.jpg`;
  const { error } = await getSupabaseClient()
    .storage.from(BUCKET)
    .upload(path, image, { contentType: 'image/jpeg' });
  if (error) throw error;
  return path;
}

/**
 * Sets an open task's pictures in order, replacing earlier ones; anyone who may edit the task can. New
 * ones must be files the user uploaded.
 */
export async function setTaskImages(taskId: string, paths: string[]): Promise<void> {
  const { error } = await getSupabaseClient().rpc('set_task_images', {
    task_id: taskId,
    paths,
  });
  if (error) throw error;
}

/**
 * Deletes picture files no task shows any more, e.g. after removing them from a task. Storage policies
 * keep files a task still shows, such as one an earlier occurrence of a repeating task shows.
 */
export async function deleteUnusedImageFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await getSupabaseClient().storage.from(BUCKET).remove(paths);
  if (error) throw error;
}

const signedUrlsSchema = z.array(
  z.object({ path: z.string().nullable(), signedUrl: z.string().nullable() }),
);

/**
 * Addresses to show the pictures from, by file name, valid for `IMAGE_URL_LIFETIME_SECONDS`. Files the
 * user may not see are left out.
 */
export async function fetchImageUrls(paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const { data, error } = await getSupabaseClient()
    .storage.from(BUCKET)
    .createSignedUrls(paths, IMAGE_URL_LIFETIME_SECONDS);
  if (error) throw error;
  return new Map(
    signedUrlsSchema
      .parse(data)
      .flatMap(({ path, signedUrl }) => (path && signedUrl ? [[path, signedUrl] as const] : [])),
  );
}
