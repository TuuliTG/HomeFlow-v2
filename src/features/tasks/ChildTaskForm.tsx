import { type SyntheticEvent, useId, useState } from 'react';

import { SegmentedChoice } from '@/components/ui/SegmentedChoice';
import { useReadyMadeTasks } from '@/features/tasks/readyMadeTasks';
import { type NewTask, newTaskSchema } from '@/features/tasks/task';
import { TaskFormButtons } from '@/features/tasks/TaskFormButtons';
import {
  type FieldName,
  fieldOf,
  fieldValues,
  taskInput,
  withReadyMadeTask,
} from '@/features/tasks/taskFormValues';
import { TaskIconField } from '@/features/tasks/TaskIconField';
import { TaskPointsField } from '@/features/tasks/TaskPointsField';
import { DailyLimitField, ScheduleFields } from '@/features/tasks/TaskTimingFields';
import { TaskTitleField } from '@/features/tasks/TaskTitleField';
import { useTaskFieldRefs, useTaskFormFields } from '@/features/tasks/useTaskFormFields';
import { useMessages } from '@/lib/i18n/i18n';

const kinds = ['always', 'custom'] as const;

/** The stars a new task for a child starts with, like a ready-made one for children. */
const CHILD_TASK_STARS = 1;

interface ChildTaskFormProps {
  childId: string;
  isSaving: boolean;
  /** Saves the task; a rejection shows "We couldn't save the task." */
  onSave: (task: NewTask) => Promise<void>;
}

/**
 * A short form adding a task for one child (ADR 0004): always there (with how many times a day it earns stars) or
 * custom (when it repeats and is due), then its name, icon and stars. Who it is for is already known.
 */
export function ChildTaskForm({ childId, isSaving, onSave }: ChildTaskFormProps) {
  const [initialValues] = useState(() => ({
    ...fieldValues(undefined, CHILD_TASK_STARS),
    forChildren: true,
    isAlways: true,
  }));
  const { fields, setFields, change, set } = useTaskFormFields(initialValues);
  const readyMade = useReadyMadeTasks({
    isNew: true,
    isForChildren: true,
    isPrivate: false,
    defaultPoints: CHILD_TASK_STARS,
    earlier: [],
  });
  const [error, setError] = useState<{ field: FieldName | null; message: string } | null>(null);
  const t = useMessages();
  const errorId = useId();
  const fieldRefs = useTaskFieldRefs();

  function errorPropsFor(field: FieldName) {
    const hasError = error?.field === field;
    return { 'aria-invalid': hasError, 'aria-describedby': hasError ? errorId : undefined };
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const parsed = newTaskSchema(t).safeParse(taskInput({ ...fields, assignedTo: childId }, false));
    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      const field = fieldOf(issue?.path[0]);
      setError({ field, message: issue?.message ?? t.taskForm.errors.checkDetails });
      fieldRefs[field].current?.focus();
      return;
    }
    onSave(parsed.data).catch(() => {
      setError({ field: null, message: t.taskForm.errors.saveFailed });
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      onChange={() => {
        setError(null);
      }}
      className="flex flex-col gap-5"
      noValidate
    >
      <SegmentedChoice
        legend={t.tasks.childTasks.kindLegend}
        options={kinds}
        labels={t.tasks.childTasks.kinds}
        value={fields.isAlways ? 'always' : 'custom'}
        onChange={(kind) => {
          change({ isAlways: kind === 'always' });
        }}
      />
      <TaskTitleField
        value={fields.title}
        onChange={set('title')}
        suggestions={[]}
        readyMade={readyMade}
        onPick={(suggestion) => {
          setFields((current) => withReadyMadeTask(current, suggestion));
        }}
        inputRef={fieldRefs.title}
        errorProps={errorPropsFor('title')}
      />
      <TaskIconField value={fields.icon} onChange={set('icon')} />
      <TaskPointsField
        isChild={false}
        forChildren="one"
        value={fields.points}
        onChange={set('points')}
        inputRef={fieldRefs.points}
        errorProps={errorPropsFor('points')}
      />
      {fields.isAlways ? (
        <DailyLimitField value={fields.dailyLimit} onChange={set('dailyLimit')} />
      ) : (
        <ScheduleFields
          repeat={fields.repeat}
          onRepeatChange={set('repeat')}
          repeatCountRef={fieldRefs.repeatEveryDays}
          repeatCountErrorProps={errorPropsFor('repeatEveryDays')}
          dueOn={fields.dueOn}
          onDueOnChange={set('dueOn')}
          dueOnRef={fieldRefs.dueOn}
          dueOnErrorProps={errorPropsFor('dueOn')}
          alreadyDone={{ offered: false, checked: false, onChange: () => undefined }}
          routine={{ offered: false, checked: false, onChange: () => undefined }}
        />
      )}
      {error && (
        <p id={errorId} role="alert" className="text-danger-700 text-sm">
          {error.message}
        </p>
      )}
      <TaskFormButtons
        submitLabel={t.taskForm.create.submit}
        disabled={isSaving}
        initial={undefined}
      />
    </form>
  );
}
