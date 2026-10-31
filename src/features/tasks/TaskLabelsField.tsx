import { type KeyboardEvent, useId, useRef, useState } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import { chipClassName } from '@/features/tasks/chipStyles';
import {
  addTypedLabel,
  canAddLabel,
  customLabelChoices,
  labelNames,
  type TaskLabels,
  toggleCustomLabel,
  toggleLabel,
} from '@/features/tasks/taskLabelChoices';
import { useCustomTaskLabels } from '@/features/tasks/useCustomTaskLabels';
import { useMessages } from '@/lib/i18n/i18n';
import {
  CUSTOM_LABEL_MAX_LENGTH,
  labelKey,
  MAX_TASK_LABELS,
  taskLabelNames,
} from '@/lib/taskLabels';

interface TaskLabelsFieldProps {
  value: TaskLabels;
  onChange: (labels: TaskLabels) => void;
  currentUserId: string;
}

const buttonClassName =
  'border-line-strong bg-surface text-brand-900 hover:bg-brand-50 min-h-11 rounded-xl border px-4 text-sm font-semibold disabled:opacity-60';

const disabledChipClassName = 'has-disabled:cursor-not-allowed has-disabled:opacity-60';

/**
 * What kinds of chore the task is: its labels, and a button that opens the ready-made labels and the household's
 * own to tick, with a field to add a new one of their own.
 */
export function TaskLabelsField({ value, onChange, currentUserId }: TaskLabelsFieldProps) {
  const t = useMessages();
  const labels = t.taskForm.labels;
  const [isOpen, setIsOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const choicesId = useId();
  const hintId = useId();
  const typedRef = useRef<HTMLInputElement>(null);
  const known = useCustomTaskLabels(currentUserId).data ?? [];
  const canAddMore = canAddLabel(value);
  const chosenNames = labelNames(value, t);
  const customKeys = new Set(value.customLabels.map(labelKey));

  function addTyped() {
    onChange(addTypedLabel(value, typed, { known, t }));
    setTyped('');
    typedRef.current?.focus();
  }

  function addOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    // Enter adds the label rather than saving the task.
    event.preventDefault();
    addTyped();
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-ink mb-1 text-sm font-medium">{labels.label}</legend>
      {chosenNames.length > 0 && (
        <p className="text-ink text-sm">{labels.chosen(t.common.joinNames(chosenNames))}</p>
      )}
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={choicesId}
        onClick={() => {
          setIsOpen((open) => !open);
        }}
        className={`${buttonClassName} w-fit`}
      >
        {isOpen ? labels.done : labels.choose}
      </button>
      <div id={choicesId} hidden={!isOpen} className="flex flex-col gap-3">
        {isOpen && (
          <>
            <div className="flex flex-wrap gap-2">
              {taskLabelNames.map((name) => {
                const isChosen = value.labels.includes(name);
                return (
                  <label key={name} className={`${chipClassName} ${disabledChipClassName}`}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isChosen}
                      disabled={!isChosen && !canAddMore}
                      onChange={() => {
                        onChange(toggleLabel(value, name));
                      }}
                    />
                    {t.common.taskLabels[name]}
                  </label>
                );
              })}
              {customLabelChoices(known, value).map((label) => {
                const isChosen = customKeys.has(labelKey(label));
                return (
                  <label
                    key={labelKey(label)}
                    className={`${chipClassName} ${disabledChipClassName}`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isChosen}
                      disabled={!isChosen && !canAddMore}
                      onChange={() => {
                        onChange(toggleCustomLabel(value, label));
                      }}
                    />
                    {label}
                  </label>
                );
              })}
            </div>
            <div className="flex items-end gap-2">
              <label className="text-ink flex flex-1 flex-col gap-1 text-sm font-medium">
                {labels.own}
                <input
                  ref={typedRef}
                  value={typed}
                  maxLength={CUSTOM_LABEL_MAX_LENGTH}
                  disabled={!canAddMore}
                  aria-describedby={canAddMore ? undefined : hintId}
                  placeholder={labels.ownPlaceholder}
                  onChange={(event) => {
                    setTyped(event.target.value);
                  }}
                  onKeyDown={addOnEnter}
                  className={`${inputClassName} min-w-0`}
                />
              </label>
              <button
                type="button"
                disabled={!canAddMore || typed.trim() === ''}
                onClick={addTyped}
                className={buttonClassName}
              >
                {labels.add}
              </button>
            </div>
            {!canAddMore && (
              <p id={hintId} className="text-ink-muted text-sm">
                {labels.tooMany(MAX_TASK_LABELS)}
              </p>
            )}
          </>
        )}
      </div>
    </fieldset>
  );
}
