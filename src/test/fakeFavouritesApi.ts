import type * as favouritesApi from '@/features/tasks/favouritesApi';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { asCurrentUser } from '@/test/fakeTasksApi';
import { fakeTasksBackend, requestsFailing } from '@/test/fakeTasksBackend';

/**
 * In-memory stand-in for `@/features/tasks/favouritesApi`, installed for every unit test in
 * `setup.ts`. Favourites live in `fakeTasksBackend` with the tasks.
 */

export const fetchFavouriteTasks: typeof favouritesApi.fetchFavouriteTasks = () => {
  const user = fakeAuthBackend.currentUser();
  if (requestsFailing() || !user) return Promise.reject(new Error('Network error'));
  return Promise.resolve(fakeTasksBackend.favouritesOf(user.id));
};

export const setFavouriteTask: typeof favouritesApi.setFavouriteTask = async (
  title,
  isFavourite,
) => {
  await fakeTasksBackend.favouriteSaved(title);
  return asCurrentUser((userId) => {
    fakeTasksBackend.setFavouriteAs(userId, title, isFavourite);
  });
};
