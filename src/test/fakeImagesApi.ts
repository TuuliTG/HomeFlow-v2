import type * as imagesApi from '@/features/tasks/imagesApi';
import { MAX_TASK_IMAGES } from '@/features/tasks/task';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { asCurrentUser, changeableTaskOf } from '@/test/fakeTasksApi';
import { canSee, deliver, requestsFailing, tasks } from '@/test/fakeTasksBackend';

/**
 * In-memory stand-in for `@/features/tasks/imagesApi`, installed for every unit test in `setup.ts`. Which
 * task shows which picture is in `fakeTasksBackend`'s tasks; the files are here.
 */

/** Uploaded picture files by name, with who uploaded them (the task-images bucket). */
const files = new Map<string, { uploadedBy: string }>();
let imageRequestsFail = false;
let settingImagesFails = false;
let uploads = 0;

function shownOn(path: string) {
  return tasks.filter((task) => task.images.includes(path));
}

/**
 * Whether `userId` sees the file, like the storage select policy: in their household's folder, and
 * uploaded by them, on a task they can see, or on no task.
 */
function canSeeFile(userId: string, path: string): boolean {
  const file = files.get(path);
  const folder = `${String(fakeHouseholdBackend.householdIdOf(userId))}/`;
  if (!file || !path.startsWith(folder)) return false;
  const tasksShowing = shownOn(path);
  return (
    file.uploadedBy === userId ||
    tasksShowing.length === 0 ||
    tasksShowing.some((task) => canSee(userId, task))
  );
}

/** Like `asCurrentUser`, but also failing when picture requests fail. */
function asUploader<T>(change: (userId: string) => T): Promise<T> {
  return imageRequestsFail ? Promise.reject(new Error('Network error')) : asCurrentUser(change);
}

export const fakeImagesBackend = {
  reset() {
    files.clear();
    imageRequestsFail = false;
    settingImagesFails = false;
    uploads = 0;
  },
  /** Every picture file stored, also ones no task shows. */
  files: () => [...files.keys()],
  /** Makes uploading and showing pictures fail, while tasks still save. */
  failImageRequests() {
    imageRequestsFail = true;
  },
  /** Makes attaching pictures to a task fail, while uploading them still works. */
  failSettingImages() {
    settingImagesFails = true;
  },
};

export const uploadTaskImage: typeof imagesApi.uploadTaskImage = (householdId) =>
  asUploader((userId) => {
    if (fakeHouseholdBackend.householdIdOf(userId) !== householdId) {
      throw new Error('Pictures go in your household folder');
    }
    uploads += 1;
    const path = `${householdId}/picture-${String(uploads)}.jpg`;
    files.set(path, { uploadedBy: userId });
    return path;
  });

/** Like `set_task_images()`. */
export const setTaskImages: typeof imagesApi.setTaskImages = (taskId, paths) =>
  asUploader((userId) => {
    if (settingImagesFails) throw new Error('Network error');
    const task = changeableTaskOf(userId, taskId);
    if (paths.length > MAX_TASK_IMAGES || new Set(paths).size !== paths.length) {
      throw new Error('At most three pictures, each once');
    }
    const mayAdd = (path: string) =>
      task.images.includes(path) || files.get(path)?.uploadedBy === userId;
    if (!paths.every(mayAdd)) throw new Error('Only pictures you uploaded');
    task.images = [...paths];
    deliver(task, { kind: 'changed' });
  });

/** Like Storage under its delete policy: only files no task shows go. */
export const deleteUnusedImageFiles: typeof imagesApi.deleteUnusedImageFiles = (paths) =>
  asUploader(() => {
    for (const path of paths) {
      if (shownOn(path).length === 0) files.delete(path);
    }
  });

/** Addresses only for the files the user may see, like signed URLs. */
export const fetchImageUrls: typeof imagesApi.fetchImageUrls = (paths) => {
  const user = fakeAuthBackend.currentUser();
  if (requestsFailing() || imageRequestsFail || !user) {
    return Promise.reject(new Error('Network error'));
  }
  return Promise.resolve(
    new Map(
      paths
        .filter((path) => canSeeFile(user.id, path))
        .map((path) => [path, `https://images.test/${path}`]),
    ),
  );
};
