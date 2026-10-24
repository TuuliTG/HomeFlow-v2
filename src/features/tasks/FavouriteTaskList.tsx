import { type FocusEvent, useEffect, useId, useRef, useState } from 'react';

import { suggestionPointsLabel } from '@/features/tasks/suggestions';
import type { TaskSuggestion } from '@/features/tasks/task';
import { useMessages } from '@/lib/i18n/i18n';

/** How long a favourite is pressed and held before it offers to be removed. */
export const LONG_PRESS_MS = 500;

interface FavouriteTaskListProps {
  suggestions: TaskSuggestion[];
  onPick: (suggestion: TaskSuggestion) => void;
  /** Unstars the favourite task with this name. */
  onRemove: (title: string) => void;
}

/**
 * The household's favourite tasks, each a button that fills in the form, or how to add some. Pressing and
 * holding one (or right-clicking it) offers to remove it from the favourites.
 */
export function FavouriteTaskList({ suggestions, onPick, onRemove }: FavouriteTaskListProps) {
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
        <>
          <ul className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <FavouriteTask
                key={suggestion.title}
                suggestion={suggestion}
                onPick={onPick}
                onRemove={onRemove}
              />
            ))}
          </ul>
          <p className="text-ink-muted text-xs">{t.taskForm.holdToRemoveFavourite}</p>
        </>
      )}
    </section>
  );
}

interface FavouriteTaskProps {
  suggestion: TaskSuggestion;
  onPick: (suggestion: TaskSuggestion) => void;
  onRemove: (title: string) => void;
}

/** One favourite: a tap fills in the form, a long press shows a button to remove it. */
function FavouriteTask({ suggestion, onPick, onRemove }: FavouriteTaskProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);
  const removeRef = useRef<HTMLButtonElement>(null);
  const hold = useLongPress(() => {
    setIsRemoving(true);
  });
  const t = useMessages();

  useEffect(() => {
    if (isRemoving) removeRef.current?.focus();
  }, [isRemoving]);

  function closeUnlessOnChip(event: FocusEvent) {
    // Lifting the finger after a long press focuses the chip before its click hands the focus back.
    if (event.relatedTarget !== chipRef.current) setIsRemoving(false);
  }

  return (
    <li className="flex items-center gap-2">
      <button
        ref={chipRef}
        type="button"
        {...hold.handlers}
        onClick={() => {
          if (hold.wasLongPress()) removeRef.current?.focus();
          else onPick(suggestion);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          setIsRemoving(true);
        }}
        className="hover:border-brand-600 hover:bg-brand-50 border-line-strong bg-surface text-ink min-h-11 rounded-full border px-3 py-2 text-sm select-none [-webkit-touch-callout:none]"
      >
        {suggestion.title}
        <span className="text-ink-muted"> · {suggestionPointsLabel(suggestion, t)}</span>
      </button>
      {isRemoving && (
        <button
          ref={removeRef}
          type="button"
          aria-label={t.taskForm.removeFavouriteLabel(suggestion.title)}
          onClick={() => {
            onRemove(suggestion.title);
          }}
          onBlur={closeUnlessOnChip}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            setIsRemoving(false);
            chipRef.current?.focus();
          }}
          className="border-danger-300 text-danger-700 hover:bg-danger-50 bg-surface min-h-11 rounded-full border px-3 py-2 text-sm font-semibold"
        >
          {t.taskForm.removeFavourite}
        </button>
      )}
    </li>
  );
}

/**
 * Calls `onLongPress` when the primary pointer is held down for `LONG_PRESS_MS`. `wasLongPress()` says
 * whether the click that follows ends a long press, so it can be ignored.
 */
function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPressed = useRef(false);

  function cancel() {
    clearTimeout(timer.current);
  }

  useEffect(() => cancel, []);

  return {
    handlers: {
      onPointerDown: (event: { button: number }) => {
        longPressed.current = false;
        if (event.button !== 0) return;
        cancel();
        timer.current = setTimeout(() => {
          longPressed.current = true;
          onLongPress();
        }, LONG_PRESS_MS);
      },
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
    },
    wasLongPress: () => longPressed.current,
  };
}
