import { type SyntheticEvent, useId, useRef, useState } from 'react';

import { SegmentedChoice } from '@/components/ui/SegmentedChoice';
import { useReadyMadeTasks } from '@/features/tasks/readyMadeTasks';
import type { NewTask } from '@/features/tasks/task';
import { TaskChildrenField } from '@/features/tasks/TaskChildrenField';
import { TaskDescriptionField } from '@/features/tasks/TaskDescriptionField';
import { TaskFormButtons } from '@/features/tasks/TaskFormButtons';
import {
  checkTask,
  type FieldName,
  fieldOf,
  type FieldValues,
  fieldValues,
  withReadyMadeTask,
} from '@/features/tasks/taskFormValues';
import { TaskIconField } from '@/features/tasks/TaskIconField';
import { type DraftImage, savedImages } from '@/features/tasks/taskImages';
import { TaskImagesField } from '@/features/tasks/TaskImagesField';
import { TaskPointsField } from '@/features/tasks/TaskPointsField';
import { DailyLimitField, ScheduleFields } from '@/features/tasks/TaskTimingFields';
import { TaskTitleField } from '@/features/tasks/TaskTitleField';
import { useTaskFieldRefs, useTaskFormFields } from '@/features/tasks/useTaskFormFields';
import { useMessages } from '@/lib/i18n/i18n';

const kinds = ['always', 'custom'] as const;

/** The stars a new task for a child starts with, like a ready-made one for children. */
const CHILD_TASK_STARS = 1;

interface ChildTaskFormProps {
  /** The task being edited; a new one is always there to begin with. */
  initial?: NewTask;
  /** The pictures of the task being edited, by file name. */
  initialImages?: string[];
  /** The child it is for: a new task's from their page, or the edited task's (null for any child). */
  childId: string | null;
  currentUserId: string;
  isSaving: boolean;
  /** Where Cancel goes when the form was opened directly. */
  cancelTo: string;
  /** Saves the task and its pictures; a rejection shows "We couldn't save the task." */
  onSave: (task: NewTask, images: DraftImage[]) => Promise<void>;
}

type FormError = { field: FieldName | 'children' | null; message: string } | null;

/**
 * The form for a task for children, adding one for a child from their page or editing one (ADR 0004): always there
 * (with how many times a day it earns stars) or custom (when it repeats and is due), then its name, description,
 * pictures, icon and stars.
 * A new task's child is already known; editing asks whose it is.
 */
export function ChildTaskForm({
  initial,
  initialImages = [],
  childId,
  currentUserId,
  isSaving,
  cancelTo,
  onSave,
}: ChildTaskFormProps) {
  const [initialValues] = useState(() =>
    initial
      ? fieldValues(initial)
      : { ...fieldValues(undefined, CHILD_TASK_STARS), forChildren: true, isAlways: true },
  );
  const { fields, setFields, change, set } = useTaskFormFields(initialValues);
  const [assignedTo, setAssignedTo] = useState(childId);
  const readyMade = useReadyMadeTasks({
    isNew: !initial,
    isForChildren: true,
    isPrivate: false,
    defaultPoints: CHILD_TASK_STARS,
    earlier: [],
  });
  const [images, setImages] = useState(() => savedImages(initialImages));
  const [isPreparingImages, setIsPreparingImages] = useState(false);
  const [error, setError] = useState<FormError>(null);
  const t = useMessages();
  const errorId = useId();
  const fieldRefs = useTaskFieldRefs();
  const childRef = useRef<HTMLSelectElement>(null);

  function errorPropsFor(field: FieldName | 'children') {
    const hasError = error?.field === field;
    return { 'aria-invalid': hasError, 'aria-describedby': hasError ? errorId : undefined };
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    // An always task is one child's (ADR 0004).
    if (fields.isAlways && assignedTo === null) {
      setError({ field: 'children', message: t.taskForm.errors.childRequired });
      childRef.current?.focus();
      return;
    }
    const parsed = checkTask({ ...fields, assignedTo }, false, t);
    if (!parsed.success) {
      const field = fieldOf(parsed.path);
      setError({ field, message: parsed.message ?? t.taskForm.errors.checkDetails });
      fieldRefs[field].current?.focus();
      return;
    }
    onSave(parsed.data, images).catch(() => {
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
      {initial && (
        <TaskChildrenField
          currentUserId={currentUserId}
          value={assignedTo}
          onChange={setAssignedTo}
          selectRef={childRef}
          errorProps={errorPropsFor('children')}
        />
      )}
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
      <TaskDescriptionField
        value={fields.description}
        onChange={set('description')}
        textareaRef={fieldRefs.description}
        errorProps={errorPropsFor('description')}
      />
      <TaskImagesField
        images={images}
        onChange={(changed) => {
          setImages(changed);
          setError(null);
        }}
        onPreparingChange={setIsPreparingImages}
        currentUserId={currentUserId}
      />
      <TaskIconField value={fields.icon} onChange={set('icon')} />
      <TaskPointsField
        isChild={false}
        forChildren
        value={fields.points}
        onChange={set('points')}
        inputRef={fieldRefs.points}
        errorProps={errorPropsFor('points')}
      />
      <ChildTaskTiming
        fields={fields}
        set={set}
        fieldRefs={fieldRefs}
        errorPropsFor={errorPropsFor}
      />
      {error && (
        <p id={errorId} role="alert" className="text-danger-700 text-sm">
          {error.message}
        </p>
      )}
      <TaskFormButtons
        submitLabel={initial ? t.taskForm.edit.submit : t.taskForm.create.submit}
        disabled={isSaving || isPreparingImages}
        initial={initial}
        cancelTo={cancelTo}
      />
    </form>
  );
}

interface ChildTaskTimingProps {
  fields: FieldValues;
  set: ReturnType<typeof useTaskFormFields>['set'];
  fieldRefs: ReturnType<typeof useTaskFieldRefs>;
  errorPropsFor: (field: FieldName) => {
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
  };
}

/** How many times a day an always task can be done, or when a custom one repeats and is due. */
function ChildTaskTiming({ fields, set, fieldRefs, errorPropsFor }: ChildTaskTimingProps) {
  if (fields.isAlways) {
    return (
      <DailyLimitField
        value={fields.dailyLimit}
        onChange={set('dailyLimit')}
        inputRef={fieldRefs.dailyLimit}
        errorProps={errorPropsFor('dailyLimit')}
      />
    );
  }
  return (
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
  );
}
