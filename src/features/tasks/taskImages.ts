import { z } from 'zod';

import { deleteUnusedImageFiles, setTaskImages, uploadTaskImage } from '@/features/tasks/imagesApi';

/** A picture on the task form: one the task already shows, or a new one to upload when saving. */
export type DraftImage =
  | { kind: 'saved'; path: string }
  | {
      kind: 'new';
      /** Tells new pictures apart in the list. */
      key: string;
      /** The picture as a JPEG (`shrinkImage`). */
      image: Blob;
      /** A `data:` address to show it before it is uploaded. */
      preview: string;
    };

/** The task's pictures on the form when editing it. */
export function savedImages(paths: string[]): DraftImage[] {
  return paths.map((path) => ({ kind: 'saved', path }));
}

/** The task was saved but its pictures weren't; it can be edited to add them again. */
export class ImagesNotSavedError extends Error {
  readonly taskId: string;

  constructor(taskId: string) {
    super('The task was saved without its pictures');
    this.taskId = taskId;
  }
}

/** Router state telling the edit page that a new task was added without its pictures. */
export const imagesNotSavedState = { imagesNotSaved: true } as const;

/** Whether the router state is `imagesNotSavedState`. */
export function isImagesNotSavedState(state: unknown): boolean {
  return z.object({ imagesNotSaved: z.literal(true) }).safeParse(state).success;
}

/** Deletes files no task needs; a failure only leaves a file behind, so it is ignored. */
function deleteFilesQuietly(paths: string[]): Promise<void> {
  return deleteUnusedImageFiles(paths).catch(() => undefined);
}

/**
 * Uploads the new pictures and returns every picture's file name in order. If an upload fails, deletes
 * the ones already uploaded and rejects.
 */
export async function uploadNewImages(householdId: string, images: DraftImage[]) {
  const uploaded: string[] = [];
  try {
    for (const draft of images) {
      if (draft.kind === 'new') uploaded.push(await uploadTaskImage(householdId, draft.image));
    }
  } catch (error) {
    await deleteFilesQuietly(uploaded);
    throw error;
  }
  let next = 0;
  const paths = images.map((draft) => (draft.kind === 'saved' ? draft.path : uploaded[next++]));
  return { paths: paths.filter((path) => path !== undefined), uploaded };
}

/**
 * Sets the task's pictures to `paths` if they changed from `before`, then deletes the files of removed
 * ones that no task needs any more. If setting them fails, deletes the newly uploaded files and rejects.
 */
export async function replaceTaskImages(
  taskId: string,
  before: string[],
  { paths, uploaded }: { paths: string[]; uploaded: string[] },
): Promise<void> {
  if (paths.length === before.length && paths.every((path, index) => path === before[index])) {
    return;
  }
  try {
    await setTaskImages(taskId, paths);
  } catch (error) {
    await deleteFilesQuietly(uploaded);
    throw error;
  }
  await deleteFilesQuietly(before.filter((path) => !paths.includes(path)));
}

/** After deleting a task, deletes the files of its pictures no other task shows. */
export function deleteImageFilesOf(paths: string[]): Promise<void> {
  return deleteFilesQuietly(paths);
}
