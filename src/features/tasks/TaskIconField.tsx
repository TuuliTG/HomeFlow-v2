import { useId } from 'react';

import { type TaskIconName, taskIconNames } from '@/features/tasks/task';
import { TaskIcon } from '@/features/tasks/TaskIcon';
import { useMessages } from '@/lib/i18n/i18n';

interface TaskIconFieldProps {
  value: TaskIconName | null;
  onChange: (icon: TaskIconName | null) => void;
}

const optionClassName =
  'has-checked:border-brand-600 has-checked:bg-brand-50 has-checked:text-brand-900 has-focus-visible:outline-brand-600 border-line-strong bg-surface text-ink-muted flex aspect-square min-h-11 cursor-pointer items-center justify-center rounded-xl border has-focus-visible:outline-2';

/** A choice of icons for the task's tile, as radio buttons named for screen readers. */
export function TaskIconField({ value, onChange }: TaskIconFieldProps) {
  const t = useMessages().taskForm.icon;
  const hintId = useId();

  function option(icon: TaskIconName | null, label: string) {
    return (
      <label key={icon ?? 'none'} title={label} className={optionClassName}>
        <input
          type="radio"
          name="icon"
          value={icon ?? ''}
          checked={value === icon}
          onChange={() => {
            onChange(icon);
          }}
          className="sr-only"
        />
        <span className="sr-only">{label}</span>
        {icon ? (
          <TaskIcon name={icon} className="size-6" />
        ) : (
          <span aria-hidden="true" className="px-1 text-center text-xs leading-tight font-semibold">
            {t.none}
          </span>
        )}
      </label>
    );
  }

  return (
    <fieldset aria-describedby={hintId} className="flex flex-col gap-2">
      <legend className="text-ink mb-1 text-sm font-medium">{t.label}</legend>
      <p id={hintId} className="text-ink-muted -mt-1 text-sm">
        {t.hint}
      </p>
      <div className="grid grid-cols-5 gap-2 md:grid-cols-10">
        {option(null, t.none)}
        {taskIconNames.map((icon) => option(icon, t.names[icon]))}
      </div>
    </fieldset>
  );
}
