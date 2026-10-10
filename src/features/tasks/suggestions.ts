import { type NewTask, type TaskSuggestion, titleKey } from '@/features/tasks/task';

/** How many matching tasks are listed while the user types a name. */
export const MATCHING_SUGGESTIONS_LIMIT = 5;

/** Earlier tasks whose name contains `query`, in the order given (most often added first). */
export function matchingSuggestions(
  suggestions: TaskSuggestion[],
  query: string,
): TaskSuggestion[] {
  const wanted = titleKey(query);
  if (wanted === '') return [];
  return suggestions
    .filter((suggestion) => titleKey(suggestion.title).includes(wanted))
    .slice(0, MATCHING_SUGGESTIONS_LIMIT);
}

/** The earlier task with exactly this name, if there is one. */
export function findSuggestion(
  suggestions: TaskSuggestion[],
  title: string,
): TaskSuggestion | undefined {
  return suggestions.find((suggestion) => titleKey(suggestion.title) === titleKey(title));
}

/** The earlier tasks the user has starred (`favouriteKeys`, from `titleKey`), by name. */
export function favouriteSuggestions(
  suggestions: TaskSuggestion[],
  favouriteKeys: string[],
): TaskSuggestion[] {
  const favourites = new Set(favouriteKeys);
  return suggestions
    .filter((suggestion) => favourites.has(titleKey(suggestion.title)))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** A new task with an earlier task's details. Its due date had passed, so the new one has none. */
export function suggestionAsTask({
  title,
  description,
  type,
  points,
  repeatEveryDays,
  isPrivate,
}: TaskSuggestion): NewTask {
  return {
    title,
    description,
    type,
    points,
    repeatEveryDays,
    isPrivate,
    dueOn: null,
  };
}

/** "1 point", "3 points", or "Private" for a private task, which has none. */
export function suggestionPointsLabel({ points }: TaskSuggestion): string {
  if (points === null) return 'Private';
  return points === 1 ? '1 point' : `${String(points)} points`;
}
