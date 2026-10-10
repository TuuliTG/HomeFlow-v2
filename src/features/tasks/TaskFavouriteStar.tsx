import { FavouriteStarButton } from '@/features/tasks/FavouriteStarButton';
import { titleKey } from '@/features/tasks/task';
import { useFavouriteTasks, useSetFavouriteTask } from '@/features/tasks/useTasks';

interface TaskFavouriteStarProps {
  /** The task's name: favourites are by name, so every task with it is starred. */
  title: string;
  currentUserId: string;
}

/**
 * The star on a task in a list, open or done, to make it one of the household's favourites offered on the
 * New task form. It waits until the favourites have loaded, and says when a change couldn't be saved.
 */
export function TaskFavouriteStar({ title, currentUserId }: TaskFavouriteStarProps) {
  const favourites = useFavouriteTasks(currentUserId);
  const setFavourite = useSetFavouriteTask(currentUserId);
  return (
    <span className="flex items-center">
      {setFavourite.isError && (
        <span role="alert" className="text-xs text-red-700">
          Not saved
        </span>
      )}
      <FavouriteStarButton
        label={`Favourite: ${title}`}
        variant="plain"
        isFavourite={favourites.data?.includes(titleKey(title)) ?? false}
        disabled={favourites.data === undefined}
        isSaving={setFavourite.isPending}
        onChange={(isFavourite) => {
          setFavourite.mutate({ title, isFavourite });
        }}
      />
    </span>
  );
}
