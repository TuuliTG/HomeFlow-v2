import { type KeyboardEvent, type RefObject, useEffect, useId, useState } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import { TaskIcon } from '@/components/ui/TaskIcon';
import { FavouriteStarButton } from '@/features/tasks/FavouriteStarButton';
import { FavouriteTaskList } from '@/features/tasks/FavouriteTaskList';
import { nameSuggestions } from '@/features/tasks/readyMadeTasks';
import { favouriteSuggestions, suggestionPointsLabel } from '@/features/tasks/suggestions';
import { TITLE_MAX_LENGTH, type TaskSuggestion, titleKey } from '@/features/tasks/task';
import { useMessages } from '@/lib/i18n/i18n';

/** The tasks the household has starred, offered on the New task form to add again. */
export interface FavouriteTasks {
  /** Their names, as `titleKey` gives them; undefined while they (or the suggestions) load. */
  keys: string[] | undefined;
  /** While a star is being saved: the star waits, so quick taps can't save out of order. */
  isSaving: boolean;
  /** Stars or unstars the task with this name. */
  onChange: (title: string, isFavourite: boolean) => void;
}

interface TaskTitleFieldProps {
  value: string;
  onChange: (title: string) => void;
  /** Tasks the household has added before, offered to add again; none when editing. */
  suggestions: TaskSuggestion[];
  /** Everyday chores to start from (`readyMadeTasks`), listed after earlier tasks; none when editing. */
  readyMade: TaskSuggestion[];
  /** Fills the form with an earlier task's details. */
  onPick: (suggestion: TaskSuggestion) => void;
  /** The household's favourites, starred with a button by the name; none when editing. */
  favourites?: FavouriteTasks | undefined;
  inputRef: RefObject<HTMLInputElement | null>;
  /** `aria-invalid` and `aria-describedby` while the title has an error. */
  errorProps: { 'aria-invalid': boolean; 'aria-describedby': string | undefined };
}

/**
 * The task's name, as a combobox with a star to make it a favourite. Tapped (or ArrowDown), it lists earlier
 * and ready-made tasks (`nameSuggestions`), narrowed down to those matching what is typed. Before anything is
 * typed, the household's favourites are offered above it.
 */
export function TaskTitleField({
  value,
  onChange,
  suggestions,
  readyMade,
  onPick,
  favourites,
  inputRef,
  errorProps,
}: TaskTitleFieldProps) {
  const listId = useId();
  const [isListOpen, setIsListOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  /** The earlier or ready-made task picked, until the name is changed. */
  const [picked, setPicked] = useState<TaskSuggestion | null>(null);
  const matches = isListOpen ? nameSuggestions(suggestions, readyMade, value) : [];
  const optionId = (index: number) => `${listId}-${String(index)}`;
  const t = useMessages();

  useEffect(() => {
    // The input keeps the focus, so the browser doesn't scroll the long list to the option chosen with the keys.
    if (activeIndex >= 0) {
      document
        .getElementById(`${listId}-${String(activeIndex)}`)
        ?.scrollIntoView({ block: 'nearest' });
    }
  }, [listId, activeIndex]);

  /** Opens the list with no task highlighted, so Enter doesn't pick one chosen before it closed. */
  function openList() {
    setIsListOpen(true);
    setActiveIndex(-1);
  }

  function pick(suggestion: TaskSuggestion) {
    setIsListOpen(false);
    setActiveIndex(-1);
    setPicked(suggestion);
    onPick(suggestion);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && !isListOpen) {
      event.preventDefault();
      openList();
      return;
    }
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (step !== undefined && matches.length > 0) {
      event.preventDefault();
      setActiveIndex((activeIndex + step + matches.length) % matches.length);
      return;
    }
    const active = matches[activeIndex];
    if (event.key === 'Enter' && active) {
      event.preventDefault();
      pick(active);
    } else if (event.key === 'Escape') {
      setIsListOpen(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {value === '' && (
        <Favourites suggestions={suggestions} favourites={favourites} onPick={pick} />
      )}
      <div className="relative flex items-end gap-2">
        <label className="text-ink flex flex-1 flex-col gap-1 text-sm font-medium">
          {t.taskForm.task}
          <input
            type="text"
            name="title"
            ref={inputRef}
            maxLength={TITLE_MAX_LENGTH}
            {...errorProps}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={matches.length > 0}
            aria-controls={listId}
            aria-activedescendant={matches[activeIndex] ? optionId(activeIndex) : undefined}
            autoComplete="off"
            placeholder={t.taskForm.titlePlaceholder}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              setPicked(null);
              setIsListOpen(true);
              setActiveIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            // Not on focus: a name left out focuses the field, and the list would cover the error.
            onClick={openList}
            onBlur={() => {
              setIsListOpen(false);
            }}
            className={inputClassName}
          />
        </label>
        {favourites && <TitleFavouriteStar title={value} favourites={favourites} />}
        <SuggestionList
          id={listId}
          matches={matches}
          activeIndex={activeIndex}
          optionId={optionId}
          onPick={pick}
        />
      </div>
      {picked?.isOpen && (
        <p className="text-notice-800 text-sm">{t.taskForm.alreadyOnBoard(picked.title)}</p>
      )}
    </div>
  );
}

interface FavouritesProps {
  suggestions: TaskSuggestion[];
  favourites: FavouriteTasks | undefined;
  onPick: (suggestion: TaskSuggestion) => void;
}

/** Before a name is typed: the household's favourites, to fill in the form from. */
function Favourites({ suggestions, favourites, onPick }: FavouritesProps) {
  if (!favourites?.keys) return null;
  return (
    <FavouriteTaskList
      suggestions={favouriteSuggestions(suggestions, favourites.keys)}
      onPick={onPick}
      onRemove={(title) => {
        favourites.onChange(title, false);
      }}
      isSaving={favourites.isSaving}
    />
  );
}

/** The star by the name field, for the task being named. */
function TitleFavouriteStar({ title, favourites }: { title: string; favourites: FavouriteTasks }) {
  const t = useMessages();
  return (
    <FavouriteStarButton
      label={t.tasks.favourite}
      variant="field"
      isFavourite={favourites.keys?.includes(titleKey(title)) ?? false}
      disabled={title.trim() === ''}
      isSaving={favourites.isSaving}
      onChange={(isFavourite) => {
        favourites.onChange(title, isFavourite);
      }}
    />
  );
}

interface SuggestionListProps {
  id: string;
  matches: TaskSuggestion[];
  activeIndex: number;
  optionId: (index: number) => string;
  onPick: (suggestion: TaskSuggestion) => void;
}

/** Earlier and ready-made tasks (matching the name being typed), below the input; scrolls when long. */
function SuggestionList({ id, matches, activeIndex, optionId, onPick }: SuggestionListProps) {
  const t = useMessages();
  return (
    <div
      id={id}
      role="listbox"
      aria-label={t.taskForm.suggestedTasks}
      // Focusable only so it can keep the focus in the input; the input handles the keys.
      tabIndex={-1}
      hidden={matches.length === 0}
      // Keeps the focus in the input, so picking or dragging the scrollbar doesn't close the list first.
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      className="border-line bg-surface absolute inset-x-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-lg border shadow-lg"
    >
      {matches.map((suggestion, index) => (
        <div
          key={suggestion.title}
          id={optionId(index)}
          role="option"
          aria-selected={index === activeIndex}
          // The input keeps the focus and handles the keys (aria-activedescendant).
          tabIndex={-1}
          onClick={() => {
            onPick(suggestion);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onPick(suggestion);
          }}
          className="text-ink aria-selected:bg-page flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm"
        >
          <span className="flex items-center gap-2">
            {suggestion.icon && <TaskIcon name={suggestion.icon} />}
            {suggestion.title}
          </span>
          <span className="text-ink-muted shrink-0">
            {suggestion.isOpen ? t.taskForm.onTheBoard : ''}
            {suggestionPointsLabel(suggestion, t)}
          </span>
        </div>
      ))}
    </div>
  );
}
