import { useId } from 'react';

import { suggestionPointsLabel } from '@/features/tasks/suggestions';
import type { TaskSuggestion } from '@/features/tasks/task';
import { useMessages } from '@/lib/i18n/i18n';

interface FavouriteTaskListProps {
  suggestions: TaskSuggestion[];
  onPick: (suggestion: TaskSuggestion) => void;
}

/** The household's favourite tasks, each a button that fills in the form, or how to add some. */
export function FavouriteTaskList({ suggestions, onPick }: FavouriteTaskListProps) {
  const headingId = useId();
  const t = useMessages();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="text-ink text-sm font-medium">
        {t.taskForm.favourites}
      </h2>
      {suggestions.length === 0 ? (
        <p className="text-ink-muted text-sm">{t.taskForm.noFavourites}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <li key={suggestion.title}>
              <button
                type="button"
                onClick={() => {
                  onPick(suggestion);
                }}
                className="hover:border-brand-600 hover:bg-brand-50 border-line-strong bg-surface text-ink min-h-11 rounded-full border px-3 py-2 text-sm"
              >
                {suggestion.title}
                <span className="text-ink-muted"> · {suggestionPointsLabel(suggestion, t)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
