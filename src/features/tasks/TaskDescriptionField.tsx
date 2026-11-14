import type { Ref } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import { DESCRIPTION_MAX_LENGTH } from '@/features/tasks/task';
import { useMessages } from '@/lib/i18n/i18n';

interface TaskDescriptionFieldProps {
  value: string;
  onChange: (description: string) => void;
  textareaRef: Ref<HTMLTextAreaElement>;
  errorProps: { 'aria-invalid': boolean; 'aria-describedby': string | undefined };
}

/** More detail about the task when its name isn't enough. */
export function TaskDescriptionField({
  value,
  onChange,
  textareaRef,
  errorProps,
}: TaskDescriptionFieldProps) {
  const t = useMessages().taskForm;
  return (
    <label className="text-ink flex flex-col gap-1 text-sm font-medium">
      {t.description}
      <textarea
        name="description"
        ref={textareaRef}
        rows={2}
        maxLength={DESCRIPTION_MAX_LENGTH}
        {...errorProps}
        placeholder={t.descriptionPlaceholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={inputClassName}
      />
    </label>
  );
}
