import type * as favouritesApi from '@/features/tasks/favouritesApi';
import { titleKey } from '@/features/tasks/task';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { asCurrentUser } from '@/test/fakeTasksApi';
import { canSee, requestsFailing, tasks } from '@/test/fakeTasksBackend';

/**
 * In-memory stand-in for `@/features/tasks/favouritesApi`, installed for every unit test in `setup.ts`, and
 * what tests use to set up stars.
 */

/** Stars on tasks, like `favourite_tasks`: one per household, name (`titleKey`) and member who starred it. */
const favourites: { householdId: string; key: string; starredBy: string }[] = [];
/** Names (`titleKey`) whose star fails to save, and saves held until released (`holdFavourite`). */
const failingFavourites = new Set<string>();
const heldFavourites = new Map<string, Promise<void>>();

/**
 * Whether `userId` sees the star (`private.can_see_favourite()`): in their household, and starred by them or on a
 * task they can see, so a star on another member's private task stays hidden.
 */
function canSeeFavourite(userId: string, star: (typeof favourites)[number]): boolean {
  return (
    star.householdId === fakeHouseholdBackend.householdIdOf(userId) &&
    (star.starredBy === userId ||
      tasks.some(
        (task) =>
          task.householdId === star.householdId &&
          titleKey(task.title) === star.key &&
          canSee(userId, task),
      ))
  );
}

export const fakeFavouritesBackend = {
  reset() {
    favourites.length = 0;
    failingFavourites.clear();
    heldFavourites.clear();
  },
  /**
   * Stars or unstars the task with this name for `userId`'s household, like `favourite_tasks`: unstarring
   * removes every star on it they can see.
   */
  setFavouriteAs(userId: string, title: string, isFavourite: boolean) {
    if (failingFavourites.has(titleKey(title))) throw new Error('Saving the star failed');
    const householdId = fakeHouseholdBackend.householdIdOf(userId);
    if (!householdId) throw new Error(`${userId} is not in a household`);
    const key = titleKey(title);
    const own = (star: (typeof favourites)[number]) =>
      star.key === key && canSeeFavourite(userId, star);
    if (!isFavourite) {
      favourites.splice(0, favourites.length, ...favourites.filter((star) => !own(star)));
    } else if (!favourites.some((star) => own(star) && star.starredBy === userId)) {
      favourites.push({ householdId, key, starredBy: userId });
    }
  },
  /** Makes starring or unstarring the task with this name fail. */
  failFavourite(title: string) {
    failingFavourites.add(titleKey(title));
  },
  /** Holds saving a star on the task with this name until the returned function is called. */
  holdFavourite(title: string): () => void {
    let release: (() => void) | undefined;
    heldFavourites.set(
      titleKey(title),
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    return () => {
      release?.();
    };
  },
  /** Resolves when a held save of a star on this name may go ahead (`holdFavourite`). */
  favouriteSaved(title: string): Promise<void> {
    return heldFavourites.get(titleKey(title)) ?? Promise.resolve();
  },
  /** The names (`titleKey`) of the favourites `userId` can see, each once. */
  favouritesOf(userId: string): string[] {
    return [
      ...new Set(
        favourites.filter((star) => canSeeFavourite(userId, star)).map((star) => star.key),
      ),
    ];
  },
};

export const fetchFavouriteTasks: typeof favouritesApi.fetchFavouriteTasks = () => {
  const user = fakeAuthBackend.currentUser();
  if (requestsFailing() || !user) return Promise.reject(new Error('Network error'));
  return Promise.resolve(fakeFavouritesBackend.favouritesOf(user.id));
};

export const setFavouriteTask: typeof favouritesApi.setFavouriteTask = async (
  title,
  isFavourite,
) => {
  await fakeFavouritesBackend.favouriteSaved(title);
  return asCurrentUser((userId) => {
    fakeFavouritesBackend.setFavouriteAs(userId, title, isFavourite);
  });
};
