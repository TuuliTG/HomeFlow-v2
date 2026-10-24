import { type KeyboardEvent, type RefObject, useId, useState } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import { FavouriteStarButton } from '@/features/tasks/FavouriteStarButton';
import { FavouriteTaskList } from '@/features/tasks/FavouriteTaskList';
import {
  favouriteSuggestions,
  matchingSuggestions,
  suggestionPointsLabel,
} from '@/features/tasks/suggestions';
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
  /** Fills the form with an earlier task's details. */
  onPick: (suggestion: TaskSuggestion) => void;
  /** The household's favourites, starred with a button by the name; none when editing. */
  favourites?: FavouriteTasks | undefined;
  inputRef: RefObject<HTMLInputElement | null>;
  /** `aria-invalid` and `aria-describedby` while the title has an error. */
  errorProps: { 'aria-invalid': boolean; 'aria-describedby': string | undefined };
}

/**
 * The task's name, as a combobox listing earlier tasks that match what is typed, with a star to make it
 * a favourite. Before anything is typed, the household's favourites are offered as buttons.
 */
export function TaskTitleField({
  value,
  onChange,
  suggestions,
  onPick,
  favourites,
  inputRef,
  errorProps,
}: TaskTitleFieldProps) {
  const listId = useId();
  const [isListOpen, setIsListOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  /** The earlier task picked to add again, until the name is changed. */
  const [picked, setPicked] = useState<TaskSuggestion | null>(null);
  const matches = isListOpen ? matchingSuggestions(suggestions, value) : [];
  const optionId = (index: number) => `${listId}-${String(index)}`;
  const t = useMessages();

  function pick(suggestion: TaskSuggestion) {
    setIsListOpen(false);
    setActiveIndex(-1);
    setPicked(suggestion);
    onPick(suggestion);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
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
      {value === '' && favourites?.keys && (
        <FavouriteTaskList
          suggestions={favouriteSuggestions(suggestions, favourites.keys)}
          onPick={pick}
          onRemove={(title) => {
            if (!favourites.isSaving) favourites.onChange(title, false);
          }}
        />
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

/** Earlier tasks matching the name being typed, below the input. */
function SuggestionList({ id, matches, activeIndex, optionId, onPick }: SuggestionListProps) {
  const t = useMessages();
  return (
    <div
      id={id}
      role="listbox"
      aria-label={t.taskForm.earlierTasks}
      hidden={matches.length === 0}
      className="border-line bg-surface absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-lg border shadow-lg"
    >
      {matches.map((suggestion, index) => (
        <div
          key={suggestion.title}
          id={optionId(index)}
          role="option"
          aria-selected={index === activeIndex}
          // The input keeps the focus and handles the keys (aria-activedescendant).
          tabIndex={-1}
          // Keeps the focus in the input, so picking doesn't close the list first.
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={() => {
            onPick(suggestion);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onPick(suggestion);
          }}
          className="text-ink aria-selected:bg-page flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm"
        >
          <span>{suggestion.title}</span>
          <span className="text-ink-muted shrink-0">
            {suggestion.isOpen ? t.taskForm.onTheBoard : ''}
            {suggestionPointsLabel(suggestion, t)}
          </span>
        </div>
      ))}
    </div>
  );
}
