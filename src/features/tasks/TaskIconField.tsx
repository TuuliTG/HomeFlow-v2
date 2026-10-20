import { useId, useRef, useState } from 'react';

import { type TaskIconName, taskIconNames } from '@/features/tasks/task';
import { TaskIcon } from '@/features/tasks/TaskIcon';
import { useMessages } from '@/lib/i18n/i18n';

interface TaskIconFieldProps {
  value: TaskIconName | null;
  onChange: (icon: TaskIconName | null) => void;
}

const buttonClassName =
  'border-line-strong bg-surface text-brand-900 hover:bg-brand-50 min-h-11 rounded-xl border px-4 text-sm font-semibold';

const optionClassName =
  'aria-pressed:border-brand-600 aria-pressed:bg-brand-50 hover:bg-brand-50 border-line bg-surface flex aspect-square min-h-11 items-center justify-center rounded-xl border';

/**
 * The task's icon, if any, and a button that opens the emojis to choose from, each a button named for
 * screen readers. Choosing one closes them again.
 */
export function TaskIconField({ value, onChange }: TaskIconFieldProps) {
  const t = useMessages().taskForm.icon;
  const [isOpen, setIsOpen] = useState(false);
  const choicesId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  function close() {
    setIsOpen(false);
    toggleRef.current?.focus();
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-ink mb-1 text-sm font-medium">{t.label}</legend>
      <div className="flex flex-wrap items-center gap-2">
        {value && (
          <span className="bg-brand-50 flex size-11 items-center justify-center rounded-xl">
            <TaskIcon name={value} className="text-2xl" />
            <span className="sr-only">{t.chosen(t.names[value])}</span>
          </span>
        )}
        <button
          ref={toggleRef}
          type="button"
          aria-expanded={isOpen}
          aria-controls={choicesId}
          onClick={() => {
            setIsOpen((open) => !open);
          }}
          className={buttonClassName}
        >
          {value ? t.change : t.choose}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
            }}
            className="text-brand-900 min-h-11 px-2 text-sm font-semibold hover:underline"
          >
            {t.remove}
          </button>
        )}
      </div>
      <div id={choicesId} hidden={!isOpen} className="grid grid-cols-6 gap-2 md:grid-cols-10">
        {isOpen &&
          taskIconNames.map((icon) => (
            <button
              key={icon}
              type="button"
              title={t.names[icon]}
              aria-label={t.names[icon]}
              aria-pressed={value === icon}
              onClick={() => {
                onChange(icon);
                close();
              }}
              className={optionClassName}
            >
              <TaskIcon name={icon} className="text-2xl" />
            </button>
          ))}
      </div>
    </fieldset>
  );
}
