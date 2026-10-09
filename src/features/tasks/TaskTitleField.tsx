import { type KeyboardEvent, type RefObject, useId, useState } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import {
  matchingSuggestions,
  suggestionPointsLabel,
  TOP_SUGGESTIONS_LIMIT,
} from '@/features/tasks/suggestions';
import { TITLE_MAX_LENGTH, type TaskSuggestion } from '@/features/tasks/task';

interface TaskTitleFieldProps {
  value: string;
  onChange: (title: string) => void;
  /** Tasks the household has added before, offered to add again; none when editing. */
  suggestions: TaskSuggestion[];
  /** Fills the form with an earlier task's details. */
  onPick: (suggestion: TaskSuggestion) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  /** `aria-invalid` and `aria-describedby` while the title has an error. */
  errorProps: { 'aria-invalid': boolean; 'aria-describedby': string | undefined };
}

/**
 * The task's name, as a combobox listing earlier tasks that match what is typed. Before anything is
 * typed, the most often added tasks are offered as buttons.
 */
export function TaskTitleField({
  value,
  onChange,
  suggestions,
  onPick,
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
      {value === '' && (
        <RecentTasks suggestions={suggestions.slice(0, TOP_SUGGESTIONS_LIMIT)} onPick={pick} />
      )}
      <div className="relative">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Task
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
            placeholder="e.g. Take out the recycling"
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
        <SuggestionList
          id={listId}
          matches={matches}
          activeIndex={activeIndex}
          optionId={optionId}
          onPick={pick}
        />
      </div>
      {picked?.isOpen && (
        <p className="text-sm text-amber-800">
          {picked.title} is already on the board. You can still add it again.
        </p>
      )}
    </div>
  );
}

interface RecentTasksProps {
  suggestions: TaskSuggestion[];
  onPick: (suggestion: TaskSuggestion) => void;
}

/** The household's most often added tasks, each a button that fills in the form. */
function RecentTasks({ suggestions, onPick }: RecentTasksProps) {
  const headingId = useId();
  if (suggestions.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="text-sm font-medium text-slate-700">
        Add again
      </h2>
      <ul className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <li key={suggestion.title}>
            <button
              type="button"
              onClick={() => {
                onPick(suggestion);
              }}
              className="hover:border-brand-600 hover:bg-brand-50 min-h-11 rounded-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            >
              {suggestion.title}
              <span className="text-slate-500"> · {suggestionPointsLabel(suggestion)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
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
  return (
    <div
      id={id}
      role="listbox"
      aria-label="Earlier tasks"
      hidden={matches.length === 0}
      className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
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
          className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm text-slate-800 aria-selected:bg-slate-100"
        >
          <span>{suggestion.title}</span>
          <span className="shrink-0 text-slate-500">
            {suggestion.isOpen ? 'On the board · ' : ''}
            {suggestionPointsLabel(suggestion)}
          </span>
        </div>
      ))}
    </div>
  );
}
