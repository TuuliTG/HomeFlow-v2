import { type FocusEvent, type PointerEvent, useEffect, useId, useRef, useState } from 'react';

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
  /** While a star is being saved: Remove waits, so quick taps can't save out of order. */
  isSaving: boolean;
}

/**
 * The household's favourite tasks, each a button that fills in the form, or how to add some. Pressing and
 * holding one (or right-clicking it, or its context-menu key) offers to remove it from the favourites.
 */
export function FavouriteTaskList({
  suggestions,
  onPick,
  onRemove,
  isSaving,
}: FavouriteTaskListProps) {
  const headingId = useId();
  const hintId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const t = useMessages();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      {/* Takes the focus from a removed favourite's Remove button, so it isn't lost. */}
      <h2
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
        className="text-ink text-sm font-medium focus:outline-none"
      >
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
                hintId={hintId}
                isSaving={isSaving}
                onPick={onPick}
                onRemove={(title) => {
                  onRemove(title);
                  headingRef.current?.focus();
                }}
              />
            ))}
          </ul>
          <p id={hintId} className="text-ink-muted text-xs">
            {t.taskForm.holdToRemoveFavourite}
          </p>
        </>
      )}
    </section>
  );
}

interface FavouriteTaskProps {
  suggestion: TaskSuggestion;
  /** The hint saying how to remove a favourite. */
  hintId: string;
  isSaving: boolean;
  onPick: (suggestion: TaskSuggestion) => void;
  onRemove: (title: string) => void;
}

/** One favourite: a tap fills in the form, a long press shows a button to remove it. */
function FavouriteTask({ suggestion, hintId, isSaving, onPick, onRemove }: FavouriteTaskProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);
  const removeRef = useRef<HTMLButtonElement>(null);
  const t = useMessages();

  function offerRemove() {
    setIsRemoving(true);
    // Already shown: the effect below won't run again.
    removeRef.current?.focus();
  }
  const hold = useLongPress(offerRemove);

  useEffect(() => {
    if (isRemoving) removeRef.current?.focus();
  }, [isRemoving]);

  function close() {
    setIsRemoving(false);
    // A right-click or an Android long press isn't followed by a click that would forget it.
    hold.forget();
  }

  function closeUnlessOnChip(event: FocusEvent) {
    // Lifting the finger after a long press focuses the chip before its click hands the focus back.
    if (event.relatedTarget !== chipRef.current) close();
  }

  return (
    <li className="flex items-center gap-2">
      <button
        ref={chipRef}
        type="button"
        aria-describedby={hintId}
        {...hold.handlers}
        onClick={() => {
          if (hold.wasLongPress()) {
            hold.forget();
            removeRef.current?.focus();
            return;
          }
          setIsRemoving(false);
          onPick(suggestion);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          hold.markLongPress();
          offerRemove();
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
          aria-disabled={isSaving || undefined}
          onClick={() => {
            if (!isSaving) onRemove(suggestion.title);
          }}
          onBlur={closeUnlessOnChip}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            close();
            chipRef.current?.focus();
          }}
          className="border-danger-300 text-danger-700 hover:bg-danger-50 bg-surface min-h-11 rounded-full border px-3 py-2 text-sm font-semibold aria-disabled:opacity-50"
        >
          {t.taskForm.removeFavourite}
        </button>
      )}
    </li>
  );
}

/** How far the finger may move while pressing and holding, in pixels, before it counts as a swipe. */
const LONG_PRESS_SLOP = 10;

/**
 * Calls `onLongPress` when the primary pointer is held down, without moving, for `LONG_PRESS_MS`.
 * `wasLongPress()` says whether the click that follows ends a long press, so it can be ignored.
 */
function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = useRef({ x: 0, y: 0 });
  const longPressed = useRef(false);

  function cancel() {
    clearTimeout(timer.current);
  }

  useEffect(() => cancel, []);

  return {
    handlers: {
      onPointerDown: (event: PointerEvent) => {
        longPressed.current = false;
        if (event.button !== 0) return;
        cancel();
        start.current = { x: event.clientX, y: event.clientY };
        timer.current = setTimeout(() => {
          longPressed.current = true;
          onLongPress();
        }, LONG_PRESS_MS);
      },
      onPointerMove: (event: PointerEvent) => {
        const moved = Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y);
        if (moved > LONG_PRESS_SLOP) cancel();
      },
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
    },
    /** For a long press the browser reports itself, as a context menu. */
    markLongPress: () => {
      cancel();
      longPressed.current = true;
    },
    /** Whether the click that follows ends a long press. */
    wasLongPress: () => longPressed.current,
    /** Forgets the long press once handled, so the next click (e.g. Enter) picks. */
    forget: () => {
      longPressed.current = false;
    },
  };
}
