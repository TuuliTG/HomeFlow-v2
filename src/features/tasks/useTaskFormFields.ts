import { useRef, useState } from 'react';

import type { FieldValues } from '@/features/tasks/taskFormValues';

/** The task form's field values, with helpers to change some or one of them. */
export function useTaskFormFields(initialValues: FieldValues) {
  const [fields, setFields] = useState(initialValues);
  return {
    fields,
    setFields,
    /** Changes some of the fields, e.g. `change({ dueOn: '' })`. */
    change: (changed: Partial<FieldValues>) => {
      setFields((current) => ({ ...current, ...changed }));
    },
    /** Changes one field, e.g. `set('title')` as the title field's `onChange`. */
    set:
      <K extends keyof FieldValues>(key: K) =>
      (value: FieldValues[K]) => {
        setFields((current) => ({ ...current, [key]: value }));
      },
  };
}

/** The inputs the form can focus to show what to fix, by the field `newTaskSchema` names. */
export function useTaskFieldRefs() {
  return {
    title: useRef<HTMLInputElement>(null),
    description: useRef<HTMLTextAreaElement>(null),
    points: useRef<HTMLInputElement>(null),
    repeatEveryDays: useRef<HTMLInputElement>(null),
    dueOn: useRef<HTMLInputElement>(null),
  };
}
