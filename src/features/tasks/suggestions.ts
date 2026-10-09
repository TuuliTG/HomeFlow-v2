import type { NewTask, TaskSuggestion } from '@/features/tasks/task';

/** How many of the most often added tasks are offered before the user types anything. */
export const TOP_SUGGESTIONS_LIMIT = 6;
/** How many matching tasks are listed while the user types a name. */
export const MATCHING_SUGGESTIONS_LIMIT = 5;

/** Names match ignoring case, like `task_suggestions()` groups them, and spaces around what is typed. */
function normalise(title: string): string {
  return title.trim().toLowerCase();
}

/** Earlier tasks whose name contains `query`, in the order given (most often added first). */
export function matchingSuggestions(
  suggestions: TaskSuggestion[],
  query: string,
): TaskSuggestion[] {
  const wanted = normalise(query);
  if (wanted === '') return [];
  return suggestions
    .filter((suggestion) => normalise(suggestion.title).includes(wanted))
    .slice(0, MATCHING_SUGGESTIONS_LIMIT);
}

/** The earlier task with exactly this name, if there is one. */
export function findSuggestion(
  suggestions: TaskSuggestion[],
  title: string,
): TaskSuggestion | undefined {
  return suggestions.find((suggestion) => normalise(suggestion.title) === normalise(title));
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
